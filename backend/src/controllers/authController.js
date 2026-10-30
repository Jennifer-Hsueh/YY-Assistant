const { handOverShared } = require('../lib/ledgers');
const { seedDefaults } = require('../lib/defaultData');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { TERMS_VERSION } = require('../lib/terms');
const { betaStatus } = require('../lib/beta');
const { sendPasswordResetEmail, sendEmail } = require('../services/emailService');
const { forgetUserStatus } = require('../middleware/auth');
const { removeUserFolder } = require('../services/communityImages');

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 30;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function register(req, res) {
  try {
    const { email, password, accept_terms } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '請輸入 Email 和密碼' });
    }
    if (accept_terms !== true) {
      return res.status(400).json({ error: '請先閱讀並同意使用條款與隱私權政策' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: '密碼至少需要 8 碼' });
    }

    const { data: existing } = await supabase
      .from('yy_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: '這個 Email 已經註冊過了' });
    }
    // 測試版名額已滿(或暫停開放註冊)
    const beta = await betaStatus();
    if (beta.full) {
      return res.status(403).json({ error: '目前測試名額已滿，謝謝你的關注', code: 'BETA_FULL' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: user, error } = await supabase
      .from('yy_users')
      .insert({ email, password_hash, terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() })
      .select('id, email, created_at')
      .single();

    if (error) throw error;

    // 預設分類與帳戶:失敗不影響註冊
    try {
      await seedDefaults(user.id, String(req.headers?.['x-lang'] || '').toLowerCase() === 'en' ? 'en' : 'zh');
    } catch (e) {
      console.error('[authController.register] seedDefaults', e.message);
    }

    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('[authController.register]', err);
    return res.status(500).json({ error: '註冊失敗，請稍後再試' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '請輸入 Email 和密碼' });
    }

    const { data: user, error } = await supabase
      .from('yy_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(401).json({ error: 'Email 或密碼不正確' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email 或密碼不正確' });
    }

    // 被管理員停用:密碼正確才告知,避免透露帳號狀態
    if (user.is_disabled) {
      return res.status(403).json({ error: process.env.SUPPORT_EMAIL ? `此帳號已停用，如有疑問請來信 ${process.env.SUPPORT_EMAIL}` : '此帳號已停用，如有疑問請與我們聯絡', code: 'ACCOUNT_DISABLED' });
    }

    await supabase
      .from('yy_users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id);

    const token = signToken(user);
    return res.json({
      user: { id: user.id, email: user.email },
      token,
    });
  } catch (err) {
    console.error('[authController.login]', err);
    return res.status(500).json({ error: '登入失敗，請稍後再試' });
  }
}

// Step 1: user submits their email. If an account exists, we generate a
// random token, store only its hash (with an expiry), and email a link
// containing the raw token. We always respond the same way regardless of
// whether the email exists, to avoid leaking which emails are registered.
async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: '請輸入 Email' });
    }

    const { data: user, error } = await supabase
      .from('yy_users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase
        .from('yy_password_reset_tokens')
        .insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });
      if (insertErr) throw insertErr;

      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (mailErr) {
        console.error('[authController.requestPasswordReset] email failed', mailErr);
        return res.status(502).json({ error: '寄信失敗，請稍後再試', code: 'EMAIL_FAILED' });
      }
    }

    // Same response whether or not the account exists.
    return res.json({ message: '如果這個 Email 有對應的帳號,重設密碼信已經寄出' });
  } catch (err) {
    console.error('[authController.requestPasswordReset]', err);
    return res.status(500).json({ error: '處理失敗，請稍後再試' });
  }
}

// Step 2: user follows the emailed link and submits { email, token, newPassword }.
async function resetPassword(req, res) {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: '重設連結不完整，請重新申請' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密碼至少需要 8 碼' });
    }

    const { data: user, error: userErr } = await supabase
      .from('yy_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (userErr) throw userErr;
    if (!user) {
      return res.status(400).json({ error: '重設連結無效或已過期，請重新申請' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: resetRow, error: tokenErr } = await supabase
      .from('yy_password_reset_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();
    if (tokenErr) throw tokenErr;
    if (!resetRow) {
      return res.status(400).json({ error: '重設連結無效或已過期，請重新申請' });
    }

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const { error: updateErr } = await supabase
      .from('yy_users')
      .update({ password_hash })
      .eq('id', user.id);
    if (updateErr) throw updateErr;

    // Mark the token used so it can't be replayed.
    await supabase
      .from('yy_password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetRow.id);

    return res.json({ message: '密碼已重設,請用新密碼登入' });
  } catch (err) {
    console.error('[authController.resetPassword]', err);
    return res.status(500).json({ error: '重設密碼失敗，請稍後再試' });
  }
}

// 登入狀態下修改密碼:要先驗證目前密碼
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '請輸入目前密碼和新密碼' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: '密碼至少需要 8 碼' });
    }
    const { data: user, error } = await supabase
      .from('yy_users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ error: '目前密碼不正確', code: 'wrong_password' });
    }
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const { error: upErr } = await supabase.from('yy_users').update({ password_hash }).eq('id', req.user.id);
    if (upErr) throw upErr;
    return res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('[authController.changePassword]', err);
    return res.status(500).json({ error: '修改密碼失敗，請稍後再試' });
  }
}

// 刪除帳號(App Store 規定要提供):確認密碼後刪除帳號與所有資料。
// 繳費紀錄依稅法保留,只留下 Email 快照;管理員帳號不能從 App 刪除
async function deleteAccount(req, res) {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: '請輸入密碼' });
    const { data: user, error } = await supabase
      .from('yy_users')
      .select('id, email, role, password_hash')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(400).json({ error: '目前密碼不正確', code: 'wrong_password' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: '管理員帳號不能從 App 刪除,請先在後台改為一般使用者', code: 'admin_account' });
    }

    // 繳費紀錄留 Email 快照(帳號刪除後 user_id 會變成空白)
    await supabase.from('yy_payments').update({ user_email: user.email }).eq('user_id', user.id);

    await handOverShared(user.id);
    await require('../lib/calendars').handOverAll(user.id);
    const { error: delErr } = await supabase.from('yy_users').delete().eq('id', user.id);
    if (delErr) throw delErr;
    forgetUserStatus(user.id);
    await removeUserFolder(user.id);

    sendEmail({
      to: user.email,
      subject: 'YY手帳 帳號已刪除',
      html: '<div style="font-family:sans-serif;line-height:1.6"><p>您好:</p><p>您的 YY手帳 帳號與所有資料已依您的要求刪除,無法復原。</p><p>如果這不是您本人的操作,請立即與我們聯絡。</p><p>謝謝您曾經使用 YY手帳。</p></div>',
    }).catch((err) => console.error('[authController.deleteAccount] email failed', err.message));

    return res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('[authController.deleteAccount]', err);
    return res.status(500).json({ error: '刪除帳號失敗，請稍後再試' });
  }
}

module.exports = { register, login, requestPasswordReset, resetPassword, changePassword, deleteAccount };

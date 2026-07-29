const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendPasswordResetEmail } = require('../services/emailService');

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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    const { data: existing } = await supabase
      .from('yy_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: user, error } = await supabase
      .from('yy_users')
      .insert({ email, password_hash })
      .select('id, email, created_at')
      .single();

    if (error) throw error;

    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('[authController.register]', err);
    return res.status(500).json({ error: 'Failed to register' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('yy_users')
      .select('id, email, password_hash')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
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
    return res.status(500).json({ error: 'Failed to log in' });
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
      return res.status(400).json({ error: 'email is required' });
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

      await sendPasswordResetEmail(user.email, resetUrl);
    }

    // Same response whether or not the account exists.
    return res.json({ message: '如果這個 Email 有對應的帳號,重設密碼信已經寄出' });
  } catch (err) {
    console.error('[authController.requestPasswordReset]', err);
    return res.status(500).json({ error: 'Failed to process password reset request' });
  }
}

// Step 2: user follows the emailed link and submits { email, token, newPassword }.
async function resetPassword(req, res) {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'email, token and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    }

    const { data: user, error: userErr } = await supabase
      .from('yy_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (userErr) throw userErr;
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
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
      return res.status(400).json({ error: 'Invalid or expired reset link' });
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
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}

module.exports = { register, login, requestPasswordReset, resetPassword };

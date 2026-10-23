// 英文介面的錯誤訊息:前端送 X-Lang: en 時,把常見的中文訊息換成英文(其他維持原文)
const EN = {
  'Email 或密碼不正確': 'Incorrect email or password',
  '修改密碼失敗，請稍後再試': 'Could not change your password. Please try again later.',
  '刪除帳號失敗，請稍後再試': 'Could not delete your account. Please try again later.',
  '寄信失敗，請稍後再試': 'Could not send the email. Please try again later.',
  '密碼至少需要 8 碼': 'Password must be at least 8 characters',
  '新密碼至少需要 8 碼': 'New password must be at least 8 characters',
  '登入失敗，請稍後再試': 'Could not log in. Please try again later.',
  '目前密碼不正確': 'Current password is incorrect',
  '目前測試名額已滿，謝謝你的關注': 'All beta spots are taken. Thanks for your interest.',
  '管理員帳號不能從 App 刪除,請先在後台改為一般使用者': 'Admin accounts cannot be deleted in the app. Change the role to user in the admin site first.',
  '處理失敗，請稍後再試': 'Something went wrong. Please try again later.',
  '註冊失敗，請稍後再試': 'Could not sign up. Please try again later.',
  '請先閱讀並同意使用條款與隱私權政策': 'Please read and agree to the Terms of Use and Privacy Policy first',
  '請輸入 Email 和密碼': 'Enter your email and password',
  '請輸入 Email': 'Enter your email',
  '請輸入密碼': 'Enter your password',
  '請輸入目前密碼和新密碼': 'Enter your current and new password',
  '這個 Email 已經註冊過了': 'An account with this email already exists',
  '這個月已經換過了，下個月才能再換': 'You already switched this month. You can switch again next month.',
  '重設密碼失敗，請稍後再試': 'Could not reset your password. Please try again later.',
  '重設連結不完整，請重新申請': 'This reset link is incomplete. Please request a new one.',
  '重設連結無效或已過期，請重新申請': 'This reset link is invalid or has expired. Please request a new one.',
  '如果這個 Email 有對應的帳號,重設密碼信已經寄出': 'If an account exists for this email, we have sent a password reset link.',
  '密碼已重設,請用新密碼登入': 'Your password has been reset. Log in with your new password.',
  '帳號已停用': 'This account has been disabled',
};
const PATTERNS = [
  [/^嘗試次數過多,請約 (\d+) 分鐘後再試$/, (m) => `Too many attempts. Please try again in about ${m[1]} minutes.`],
  [/^社群功能暫停到 (.+)，期間只能發表僅自己可見的文章$/, (m) => `Community is paused until ${m[1]}. You can still write private posts.`],
];

function translate(text) {
  if (typeof text !== 'string') return text;
  if (EN[text]) return EN[text];
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

// Express middleware:包裝 res.json
function langMiddleware(req, res, next) {
  if ((req.get('x-lang') || '').toLowerCase() !== 'en') return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      if (body.error) body = { ...body, error: translate(body.error) };
      if (body.message) body = { ...body, message: translate(body.message) };
    }
    return json(body);
  };
  return next();
}

module.exports = { langMiddleware, translate };

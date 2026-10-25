// 英文介面的錯誤訊息:前端送 X-Lang: en 時,把常見的中文訊息換成英文(其他維持原文)
const EN = {
  '請輸入紀念日名稱': 'Please enter a name',
  '日期格式不正確': 'Invalid date',
  '提醒設定不正確': 'Invalid reminder setting',
  '找不到這個紀念日': 'Anniversary not found',
  '一個紀念日最多邀請 30 位': 'You can invite up to 30 people',
  '只有建立者可以移出成員': 'Only the creator can remove people',
  '讀取紀念日失敗': 'Could not load anniversaries',
  '新增紀念日失敗': 'Could not add the anniversary',
  '修改紀念日失敗': 'Could not update the anniversary',
  '刪除紀念日失敗': 'Could not delete the anniversary',
  '一個行程最多邀請 30 位': 'You can invite up to 30 people to an event',
  '只有行程建立者可以移出成員': 'Only the event creator can remove people',
  '讀取邀請失敗': 'Could not load invites',
  '回覆失敗': 'Could not reply',
  '共同帳本不能刪除，請使用「退出」': 'Shared ledgers cannot be deleted. Use "Leave" instead.',
  '只能邀請你的好友': 'You can only invite your friends',
  '對方已經在這本帳本裡': 'This person is already in the ledger',
  '一本帳本最多 11 人': 'A ledger can have up to 11 people',
  '這本帳本沒有其他成員，可以直接刪除': 'No other members. You can delete this ledger instead.',
  '只有帳本建立者可以移出成員': 'Only the ledger creator can remove members',
  '找不到這位成員': 'Member not found',
  '邀請失敗': 'Could not send the invite',
  '加入失敗': 'Could not join',
  '退出失敗': 'Could not leave',
  '移出失敗': 'Could not remove',
  '找不到這本帳本': 'Ledger not found',
  '這本帳本只能查看': 'This ledger is view-only',
  '帳戶不在這本帳本裡': 'This account is not in the current ledger',
  '請輸入帳本名稱': 'Please enter a ledger name',
  '帳本最多 20 本': 'You can have up to 20 ledgers',
  '至少要保留一本帳本': 'You need to keep at least one ledger',
  '讀取帳本失敗': 'Could not load ledgers',
  '新增帳本失敗': 'Could not create the ledger',
  '修改帳本失敗': 'Could not update the ledger',
  '刪除帳本失敗': 'Could not delete the ledger',
  '找不到這組好友碼': 'No one found with this friend code',
  '這是你自己的好友碼': 'This is your own friend code',
  '好友最多 200 位': 'You can have up to 200 friends',
  '送出的邀請太多了，請等對方回覆或取消一些邀請': 'Too many pending invites. Wait for replies or cancel some first.',
  '找不到這個邀請': 'Invite not found',
  '不能封鎖自己': 'You cannot block yourself',
  '不能檢舉自己': 'You cannot report yourself',
  '找不到這位使用者': 'User not found',
  '讀取好友失敗': 'Could not load friends',
  '送出邀請失敗': 'Could not send the invite',
  '接受邀請失敗': 'Could not accept the invite',
  '操作失敗': 'Something went wrong',
  '封鎖失敗': 'Could not block',
  '解除封鎖失敗': 'Could not unblock',
  '檢舉失敗': 'Could not send the report',
  '更換好友碼失敗': 'Could not change your friend code',
  '查詢失敗': 'Lookup failed',
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

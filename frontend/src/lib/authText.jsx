import { useLanguage } from '../context/LanguageContext';

// 登入、註冊、忘記密碼、重設密碼、條款同意的中英文
const TEXT = {
  zh: {
    langSwitch: 'EN',
    hello: '歡迎回來！',
    helloNew: '一起來記錄吧！',
    login: '登入',
    loggingIn: '登入中…',
    email: 'Email',
    password: '密碼 Password',
    passwordNew: '密碼 Password（至少 8 碼）',
    expired: '登入已逾時，請重新登入',
    deleted: '帳號已刪除，謝謝您曾經使用 YY手帳',
    disabled: '此帳號已停用，如有疑問請與我們聯絡',
    forgot: '忘記密碼?',
    noAccount: '還沒有帳號?',
    register: '註冊',
    registerTitle: '建立帳號',
    registering: '建立中…',
    haveAccount: '已經有帳號?',
    betaFull: (n) => `目前 ${n} 位測試名額已滿，謝謝你的關注`,
    betaInfo: (n, r) => `測試版開放 ${n} 位測試者，還有 ${r} 個名額。目前暫不限定測試結束日期，決定後會提前兩週通知，屆時請自行備份資料。`,
    foundingTitle: '🦫 創始會員福利：測試期間使用滿 5 天，正式上線後送你一年全功能',
    foundingTerms: [
      '有打開 App 或有記錄的日子都算，不必連續，同一天只算一次',
      '一年從正式上線、開通那天開始計算',
      '限本人帳號使用，不能轉讓；違反使用規範者取消資格',
      '測試結束時資料會清空，但創始會員資格會保留',
    ],
    agree: '我已閱讀並同意',
    and: '與',
    terms: '使用條款',
    privacy: '隱私權政策',
    forgotTitle: '忘記密碼',
    forgotDesc: '輸入您的 Email，我們會寄送重設密碼的連結給您。',
    sending: '寄送中…',
    sendLink: '寄送重設連結',
    sentFallback: '如果這個 Email 有對應的帳號，重設密碼信已經寄出',
    backToLogin: '返回登入',
    resetTitle: '設定新密碼',
    newPassword: '新密碼 New password（至少 8 碼）',
    resetting: '設定中…',
    reset: '重設密碼',
    resetDone: '密碼已重設，正在前往登入頁…',
    badLink: '這個連結無效或已過期，請重新',
    requestAgain: '申請重設密碼',
    consentTitle: '使用條款與隱私權政策',
    consentDesc: '請閱讀並同意後繼續使用。',
    logout: '登出',
    agreeContinue: '同意並繼續',
    sendFailed: '送出失敗，請稍後再試',
    updated: '最後更新',
    done: '已閱讀完成',
    close: '關閉',
    back: '返回',
  },
  en: {
    langSwitch: '中文',
    hello: 'Welcome back!',
    helloNew: "Let's start writing!",
    login: 'Log in',
    loggingIn: 'Logging in…',
    email: 'Email',
    password: 'Password',
    passwordNew: 'Password (at least 8 characters)',
    expired: 'Your session expired. Please log in again.',
    deleted: 'Your account has been deleted. Thank you for using YY Assistant.',
    disabled: 'This account has been disabled. Contact us if you have questions.',
    forgot: 'Forgot password?',
    noAccount: 'No account yet?',
    register: 'Sign up',
    registerTitle: 'Create an account',
    registering: 'Creating…',
    haveAccount: 'Already have an account?',
    betaFull: (n) => `All ${n} beta spots are taken. Thanks for your interest.`,
    betaInfo: (n, r) => `The beta is open to ${n} testers, ${r} spots left. There is no end date yet. We will give two weeks' notice before it ends, so you can back up your data.`,
    foundingTitle: '🦫 Founding member perk: use the app on 5 days during the beta, get 1 year of full access free after launch',
    foundingTerms: [
      'Any day you open the app or add a record counts. Days need not be in a row; each day counts once',
      'The year starts on the day it is activated after launch',
      'For your own account only and not transferable. It may be revoked for violating the Terms',
      'Beta data will be cleared when the beta ends, but your founding member status stays',
    ],
    agree: 'I have read and agree to the',
    and: 'and',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    forgotTitle: 'Forgot password',
    forgotDesc: "Enter your email and we'll send you a link to reset your password.",
    sending: 'Sending…',
    sendLink: 'Send reset link',
    sentFallback: 'If an account exists for this email, we have sent a password reset link.',
    backToLogin: 'Back to log in',
    resetTitle: 'Set a new password',
    newPassword: 'New password (at least 8 characters)',
    resetting: 'Saving…',
    reset: 'Reset password',
    resetDone: 'Password reset. Taking you to log in…',
    badLink: 'This link is invalid or has expired. Please',
    requestAgain: 'request a new one',
    consentTitle: 'Terms of Use and Privacy Policy',
    consentDesc: 'Please read and agree to continue.',
    logout: 'Log out',
    agreeContinue: 'Agree and continue',
    sendFailed: 'Could not send. Please try again later.',
    updated: 'Last updated',
    done: 'Done reading',
    close: 'Close',
    back: 'Back',
  },
};

export function useAuthText() {
  const { language, toggleLanguage } = useLanguage();
  return { A: TEXT[language] || TEXT.zh, language, toggleLanguage };
}

// 登入／註冊等頁右上角的語言切換
export function AuthLangSwitch() {
  const { A, language, toggleLanguage } = useAuthText();
  return (
    <button type="button" onClick={toggleLanguage} lang={language === 'en' ? 'zh-Hant' : 'en'}
      className="fixed right-4 z-10 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-black/5" style={{ color: 'var(--ink)', top: 'calc(var(--sat, 0px) + 12px)' }}>
      {A.langSwitch}
    </button>
  );
}

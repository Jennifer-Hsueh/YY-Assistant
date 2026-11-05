import { useEffect, useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';

// 安全提醒:每位使用者第一次進來(同意條款後)跳出一次;之後可在「使用說明」再看
// 是否看過記在這台裝置(換裝置會再提醒一次,提醒多看一次沒關係)
const KEY = (uid) => `yy_safety_seen_${uid}`;

export const SAFETY_ITEMS = {
  zh: [
    ['🔒', '保護個人資料', '不要在社群、小紙條或任何地方，透露電話、地址、身分證字號、工作地點，或銀行帳號、密碼。'],
    ['🚫', '我們不會私訊跟你要錢', 'YY手帳 不會透過小紙條、社群、Email、LINE 或電話，向你索取銀行資料、密碼或個人資訊，也不會主動要求你匯款續約。續約只在 App 的「設定 → 我的方案」自己操作。'],
    ['📢', '官方消息只看「公告」', '官方消息只會出現在 App 的「公告」。自稱客服、要你點連結或加 LINE 的訊息，都不要相信。'],
    ['🤝', '網路交友請審慎評估', '網路上認識的朋友，提到見面、借錢、投資或代購，都要特別小心，先和家人朋友討論。'],
    ['🛡️', '遇到可疑訊息', '小紙條可以撕掉並封鎖對方；社群文章可以檢舉；也可以到「設定 → 故障通報」告訴我們。懷疑遇到詐騙，請撥 165 反詐騙諮詢專線。'],
  ],
  en: [
    ['🔒', 'Protect your personal info', 'Never share your phone number, address, ID number, workplace, bank account or password in Community, little notes, or anywhere else.'],
    ['🚫', 'We never message you for money', 'YY will never ask for bank details, passwords or personal info through little notes, Community, email, LINE or phone calls, and will never ask you to transfer money to renew. Renewals happen only under Settings → My plan in the app.'],
    ['📢', 'Official news is in Announcements only', 'Official messages appear only in the app’s Announcements. Do not trust anyone claiming to be support who asks you to tap a link or add them on LINE.'],
    ['🤝', 'Be careful making friends online', 'If someone you met online talks about meeting up, lending money, investing or buying things for you, be extra careful and talk it over with people you trust.'],
    ['🛡️', 'If something feels off', 'Tear off the note and block the sender, report the post, or tell us under Settings → Report a problem. If you think it is a scam, call Taiwan’s 165 anti-fraud hotline.'],
  ],
};

export function SafetyList({ lang }) {
  return (
    <ul className="space-y-3">
      {(SAFETY_ITEMS[lang] || SAFETY_ITEMS.zh).map(([icon, title, text]) => (
        <li key={title} className="flex gap-3">
          <span className="text-xl leading-6">{icon}</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{title}</span>
            <span className="block text-sm leading-relaxed text-muted-foreground">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function SafetyNotice() {
  const { user } = useAuth();
  const { ent, termsOk } = usePlan();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  // 方案資料載入、也同意條款之後才檢查(不和條款同意視窗疊在一起)
  useEffect(() => {
    if (!user?.id || !ent || !termsOk) return;
    let seen = false;
    try { seen = !!localStorage.getItem(KEY(user.id)); } catch { /* 無痕模式 */ }
    if (!seen) setOpen(true);
  }, [user?.id, ent, termsOk]);

  if (!open) return null;
  function close() {
    try { localStorage.setItem(KEY(user.id), new Date().toISOString()); } catch { /* 無痕模式 */ }
    setOpen(false);
  }
  const en = language === 'en';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <img src="/reactions/approve.webp" alt="" className="h-14 w-14" />
          <div>
            <p className="font-semibold">{en ? 'Beaver’s safety tips' : '小河狸的安全提醒'}</p>
            <p className="text-xs text-muted-foreground">{en ? 'A few things to keep you safe' : '使用前，請花一分鐘看看這幾件事'}</p>
          </div>
        </div>
        <SafetyList lang={language} />
        <Button className="mt-5 w-full" onClick={close}>{en ? 'Got it' : '我知道了'}</Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">{en ? 'You can read this again in Help.' : '之後可以在「使用說明」再看一次。'}</p>
      </div>
    </div>
  );
}

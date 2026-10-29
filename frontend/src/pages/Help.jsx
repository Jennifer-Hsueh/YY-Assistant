import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { isNative } from '../lib/platform';
import { useBeta } from '../lib/useBeta';
import { useLanguage } from '../context/LanguageContext';

// 使用說明(中英文;要修改直接改下面的 SECTIONS)
// section 的 beta:只在測試期間顯示;web:只在網頁版顯示
// item 可以是字串,或 { text, web: true }(只在網頁版顯示,例如付款相關)
const SECTIONS = {
  zh: [
    { title: '測試版', beta: true, items: [
      '目前是測試版，開放有限名額的測試者使用，測試期間可以使用全部功能。',
      '測試期間使用滿 5 天，正式上線後送你一年全功能。',
      '測試結束日決定後，會提前兩週以公告通知。結束前請到「設定 → 資料匯出 / 備份」下載備份檔。',
      '使用上遇到問題或有建議，歡迎用「設定 → 故障通報」告訴我們。',
    ] },
    { title: '開始使用', web: true, items: [
      'iPhone：用 Safari 開啟網站 → 點下方「分享」→「加入主畫面」，之後從主畫面的 YY手帳 圖示開啟。要收到通知，一定要從主畫面開啟。',
      'Android：用 Chrome 開啟網站 → 右上角選單 →「安裝應用程式」或「加到主畫面」。',
      '登入後會保持 7 天，超過時間會請您重新登入。',
    ] },
    { title: '首頁', items: [
      '一眼看到今天的行程、本月累積消費、預算、紀念日、墨箋絮語和小紙條。',
      '名字後面的小圓圖示是「本日心情」，點一下就能選今天的心情；還沒選時會直接展開九種天氣。',
      '右下角「＋」可以快速記一筆、新增行程或寫一則待辦記事。',
      '方案快到期或有重要公告時，首頁上方會出現提醒。',
      '畫面左下角偶爾會冒出小河狸，提醒你好友生日、紀念日或新的小紙條。點一下就會消失，同一句話一天只出現一次。',
    ] },
    { title: '記帳', items: [
      '建議先到「帳戶管理」建立現金、銀行、信用卡等帳戶，並填入目前金額。',
      '「新增」記一筆收入或支出；「轉帳」在兩個帳戶之間移動金額；「編輯」可以修改或刪除。',
      '「管理分類」可以自訂分類和顏色；日曆檢視會用當天最高一筆支出的分類顏色標示。',
      '「循環」適合房租、訂閱等固定收支，到期會自動入帳。',
      '「統計分析」可以看每月摘要、設定每月預算，以及依條件分析。',
    ] },
    { title: '帳本與共同帳本', items: [
      '記帳頁上方可以切換帳本，例如「日常」「旅遊」「家用」。在「管理帳本」可以新增、改名或刪除帳本。',
      '分類是所有帳本共用的；帳戶、記帳、預算、循環記帳則是每本帳本各自分開。',
      '共同帳本：在「管理帳本」按帳本旁的人像＋，邀請好友加入。建立者和成員都可以邀請，一本最多 11 人。',
      '成員記帳時，其他成員會收到通知；列表上會顯示是誰記的。',
      '共同帳本不能刪除，只能「退出」；退出後仍可查看，但不能新增或修改。建立者退出時，帳本會交給最早加入的成員；沒有其他成員時，帳本會變成只能查看。',
      '建立者可以把成員移出帳本。',
    ] },
    { title: '行事曆與共同行程', items: [
      '新增行程時可以設定結束時間（可以跨日）、分類顏色和提醒時間。',
      '「循環行程」適合每週固定的課程、每月的繳費日等。',
      '可以切換月檢視和週檢視，「查詢」可以找過去或未來的行程。',
      '共同行程：新增或編輯行程時邀請好友，對方在首頁按「加入」後就會出現在他的行事曆。所有成員都可以修改行程。',
    ] },
    { title: '紀念日與好友生日', items: [
      '到「行事曆 → 紀念日」新增。日期直接輸入 8 碼（例如 20201029）；勾選「不知道年份」時只要輸入 4 碼月日。',
      '可以選 16 種小圖示，紀念日會連同圖示顯示在行事曆上。',
      '可以設定「每年循環」、「顯示紀念年次」或「顯示年紀」；提醒可選不提醒、當天或前 3 天（前 3 天和當天都會提醒）。',
      '也可以邀請好友一起記同一個紀念日。',
      '好友生日：到「設定 → 生日」設定自己的生日、是否讓好友知道，以及要不要開啟「好友生日提醒」。好友公開的生日會自動列在紀念日頁。',
    ] },
    { title: '墨箋絮語', items: [
      '隨手記下待辦事項，完成後打勾。首頁只顯示還沒完成的項目。',
      '在首頁的墨箋絮語卡片輸入文字後，按 Enter 就會新增。',
    ] },
    { title: '好友', items: [
      '到「社群 → 好友」查看自己的好友碼，可以複製、出示 QR Code 或分享邀請連結。',
      '輸入對方的好友碼送出邀請，對方接受後就成為好友。',
      '點好友的名字可以看他分享的文章（僅好友可見與公開・暱稱的文章；匿名和對你隱藏的文章不會出現）。',
      '好友旁的「⋯」可以解除好友、封鎖或檢舉。',
      '共同帳本、共同行程、共同紀念日都只能邀請好友，請先加好友。',
    ] },
    { title: '小紙條', items: [
      '在首頁的小紙條卡片按「寫一張」，可以傳給好友，以及共同帳本、共同行程、共同紀念日的成員，每張最多 25 個字。',
      '收到小紙條時會收到推播，打開首頁會跳出紙條；還沒看的紙條會在卡片上方貼一張便利貼，選單的「首頁」也會出現紅點。',
      '點開紙條可以「回一張」、「撕掉」或「封鎖」對方。紙條會一直保留，直到你撕掉為止。',
      '送出的紙條在對方還沒看之前可以收回。',
    ] },
    { title: '社群', items: [
      '進入社群會先看到使用規則，點上方的版名後開始瀏覽。',
      '「晴空與雨天」分享心情、「養豬小能手」交流理財、「小編許願池」許願新功能，「微光拾憶」是只屬於自己的紀錄。',
      '公開範圍有四種：僅自己、公開・匿名、僅好友可見、公開・暱稱。每篇最多附 3 張照片。',
      '發文時可以「隱藏好友」：選擇對全部好友，或對特定好友隱藏這篇文章。',
      '各版上方可以切換「全部」或「好友」，只看好友的文章。',
      '「晴空與雨天」可以用小河狸回應：抱抱、加油、我懂、大笑、肯定。',
      '看到不當內容請按文章下方的「檢舉」，並選擇原因。心情低落需要協助時，請撥打安心專線。',
    ] },
    { title: '主題與語言', items: [
      '到「設定 → 介面設定」切換四種風格：米紙、石墨灰、莫蘭迪、運動風。設定會跟著帳號，換裝置也一樣。',
      '畫面上方的「EN／中文」可以切換介面語言。',
    ] },
    { title: '通知', items: [
      '到「設定 → 通知設定」分別開啟帳務通知和行程通知，第一次開啟時請允許通知權限。',
      '共同帳本有人記帳、收到小紙條、好友與共同行程的邀請，也會用推播通知你。',
      'iPhone 需要 iOS 16.4 以上，而且要從主畫面開啟 YY手帳 才收得到通知。',
    ] },
    { title: '方案', items: [
      '註冊後三個月免費試用全部功能。',
      '試用結束或方案到期（含 7 天寬限期）後，改為免費的基本功能：記帳或行事曆二擇一，每個月可以換一次。',
      '到期前 30、10、3 天和當天，會用 Email 和 App 通知提醒您。',
      '目前的方案和到期日在「設定 → 我的方案」。',
      { text: '付費：轉帳後到網頁版「設定 → 我的方案」按「我已匯款，回報匯款資料」，填寫匯款日期、金額、方案和帳號末 5 碼，並勾選同意退費規則。確認入帳後會以公告通知您。', web: true },
    ] },
    { title: '資料與帳號', items: [
      '「設定 → 資料匯出 / 備份」可以匯出 Excel 或下載完整備份檔。',
      '忘記密碼：在登入頁點「忘記密碼？」，到信箱收重設連結（30 分鐘內有效）。',
      '「設定 → 刪除帳號」會永久刪除帳號和所有資料，無法復原。你在共同帳本記過的帳會保留給其他成員，顯示為「已刪除的成員」。',
    ] },
    { title: '常見問題', items: [
      '邀請好友時名單顯示「咦？空的？」：代表你的好友都已經在這本帳本裡了，或是還沒有好友，先到「社群 → 好友」加好友。',
      '收不到重設密碼信：請檢查垃圾信匣；仍然沒有的話，請用「設定 → 故障通報」告訴我們。',
      '收不到通知：確認手機的通知權限已開啟，iPhone 請從主畫面開啟 YY手帳。',
      '其他問題或建議：歡迎使用「設定 → 故障通報」，或到「小編許願池」許願。',
    ] },
  ],
  en: [
    { title: 'Beta', beta: true, items: [
      'This is a beta open to a limited number of testers. You can use every feature during the beta.',
      'Use the app on 5 days during the beta and get one year of full access free after launch.',
      'Once the end date is set, we will announce it two weeks ahead. Before it ends, download a backup from Settings → Export / backup.',
      'If something goes wrong or you have ideas, tell us in Settings → Report an issue.',
    ] },
    { title: 'Getting started', web: true, items: [
      'iPhone: open the site in Safari → tap Share → Add to Home Screen, then open YY Assistant from your home screen. Notifications only work when opened from the home screen.',
      'Android: open the site in Chrome → menu → Install app or Add to Home screen.',
      'You stay logged in for 7 days, after which you will be asked to log in again.',
    ] },
    { title: 'Home', items: [
      'See today’s events, this month’s spending, budgets, anniversaries, Ink Notes and little notes at a glance.',
      'The small circle after your name is your daily mood. Tap it to pick today’s mood; if you haven’t picked one yet, the nine weather icons open right away.',
      'Tap + at the bottom right to quickly add an entry, an event or a to-do.',
      'Reminders appear at the top when your plan is about to end or there is an important announcement.',
      'A little beaver sometimes pops up at the bottom left to remind you of a friend’s birthday, an anniversary or a new little note. Tap it to close; each message appears once a day.',
    ] },
    { title: 'Ledger', items: [
      'Start by creating accounts (cash, bank, credit card) in Accounts with their current balances.',
      'Add records income or expenses, Transfer moves money between accounts, and Edit lets you change or delete entries.',
      'Manage categories to set your own categories and colors. The calendar view colors each day by its largest expense.',
      'Recurring is for fixed items like rent or subscriptions, recorded automatically when due.',
      'Statistics shows monthly summaries, lets you set monthly budgets, and analyzes by filters.',
    ] },
    { title: 'Ledgers and shared ledgers', items: [
      'Switch ledgers at the top of the Ledger page, for example Daily, Trip or Home. Add, rename or delete ledgers in Manage ledgers.',
      'Categories are shared by all ledgers; accounts, entries, budgets and recurring entries belong to each ledger.',
      'Shared ledgers: in Manage ledgers, tap the person+ icon next to a ledger to invite friends. Both the creator and members can invite, up to 11 people per ledger.',
      'When a member adds an entry, the others get a notification, and the list shows who recorded it.',
      'Shared ledgers can’t be deleted, only left. After leaving you can still view it but not change it. If the creator leaves, the earliest member takes over; with no other members, the ledger becomes view-only.',
      'The creator can remove members.',
    ] },
    { title: 'Calendar and shared events', items: [
      'When adding an event you can set an end time (multi-day is fine), a category color and a reminder.',
      'Recurring events are for weekly classes, monthly bill days and so on.',
      'Switch between month and week views; Search finds past or future events.',
      'Shared events: invite friends when adding or editing an event. Once they tap Join on their home page, it shows in their calendar. Every member can edit the event.',
    ] },
    { title: 'Anniversaries and birthdays', items: [
      'Add them in Calendar → Anniversaries. Type the date as 8 digits (e.g. 20201029); with “Year unknown” ticked, type just 4 digits for month and day.',
      'Pick one of 16 little icons; anniversaries show on the calendar with their icon.',
      'Choose “Repeat every year”, “Show years” or “Show age”. Reminders: none, on the day, or 3 days before (also on the day).',
      'You can invite friends to share the same anniversary.',
      'Friends’ birthdays: in Settings → Birthday, set your birthday, whether friends can see it, and turn friends’ birthday reminders on or off. Birthdays your friends share are listed on the Anniversaries page.',
    ] },
    { title: 'Ink Notes', items: [
      'Jot down to-dos and check them off when done. Home shows only what’s left.',
      'On the Ink Notes card on Home, type and press Enter to add.',
    ] },
    { title: 'Friends', items: [
      'Go to Community → Friends to see your friend code. Copy it, show a QR code or share an invite link.',
      'Enter someone’s friend code to send a request; you become friends once they accept.',
      'Tap a friend’s name to see what they share (friends-only and nickname posts; anonymous posts and posts hidden from you don’t appear).',
      'Use “⋯” next to a friend to unfriend, block or report.',
      'Shared ledgers, events and anniversaries can only be shared with friends, so add friends first.',
    ] },
    { title: 'Little notes', items: [
      'Tap Write one on the Little notes card on Home to send a note of up to 25 characters to friends or people you share a ledger, event or anniversary with.',
      'You get a push notification for new notes, and they pop up when you open Home. Unread notes put a sticky note on the card and a red dot on Home in the menu.',
      'Tap a note to Reply, Tear off, or Block the sender. Notes stay until you tear them off.',
      'You can take back a note you sent until the other person reads it.',
    ] },
    { title: 'Community', items: [
      'Opening Community shows the rules first. Tap a board name to start browsing.',
      'Sun & Rain is for feelings, Piggy Bank for money tips, Wishing Well for feature requests, and Glimmers is just for you.',
      'Four visibility options: private, public anonymous, friends only, and public with nickname. Up to 3 photos per post.',
      'When posting you can hide the post from all friends or from chosen friends.',
      'Switch between All and Friends at the top of each board to see only friends’ posts.',
      'In Sun & Rain you can respond with little beavers: Hug, Cheer, I get it, Haha and Agree.',
      'Report inappropriate posts with the Report link below them. If you are feeling low and need help, please call a helpline.',
    ] },
    { title: 'Themes and language', items: [
      'Go to Settings → Interface to choose one of four styles: Rice paper, Graphite, Morandi or Sporty. It follows your account on every device.',
      'Use EN / 中文 at the top to switch the language.',
    ] },
    { title: 'Notifications', items: [
      'Turn on ledger and calendar notifications in Settings → Notifications, and allow notifications when asked.',
      'You’ll also be notified about entries in shared ledgers, new little notes, and friend or event invitations.',
      'iPhone needs iOS 16.4 or later, and YY Assistant must be opened from the home screen to receive notifications.',
    ] },
    { title: 'Plans', items: [
      'Every feature is free for three months after you sign up.',
      'After the trial or when a plan ends (including a 7-day grace period), your account switches to free Basic: Ledger or Calendar, changeable once a month.',
      'We remind you by email and in the app 30, 10 and 3 days before your plan ends, and on the day.',
      'Your current plan and end date are in Settings → My plan.',
      { text: 'Paying: after transferring, go to Settings → My plan on the website and tap “I’ve paid. Report my transfer”. Enter the date, amount, plan and last 5 digits of your account, and agree to the refund policy. We will let you know once it’s confirmed.', web: true },
    ] },
    { title: 'Data and account', items: [
      'Settings → Export / backup lets you export to Excel or download a full backup.',
      'Forgot your password? Tap “Forgot password?” on the login page and check your email for a reset link (valid for 30 minutes).',
      'Settings → Delete account permanently deletes your account and data. Entries you made in shared ledgers stay for the other members, shown as “Deleted member”.',
    ] },
    { title: 'FAQ', items: [
      'The invite list says “Huh? Nobody here?”: all your friends are already in this ledger, or you don’t have friends yet. Add friends in Community → Friends.',
      'No password reset email? Check your spam folder; if it’s still missing, tell us in Settings → Report an issue.',
      'Not getting notifications? Check that notifications are allowed on your phone; on iPhone, open YY Assistant from the home screen.',
      'Other questions or ideas? Use Settings → Report an issue, or make a wish in Wishing Well.',
    ] },
  ],
};

const UI = {
  zh: { title: '使用說明', terms: '使用條款', privacy: '隱私權政策' },
  en: { title: 'Help', terms: 'Terms of use', privacy: 'Privacy policy' },
};

export default function Help() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const beta = useBeta();
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'zh';
  const T = UI[lang];
  const sections = SECTIONS[lang].filter((s) => !(s.web && isNative) && !(s.beta && !beta?.active));

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-40 md:max-w-3xl md:px-8 md:py-10">
      <h1 className="page-title-row page-title mb-4 flex items-center gap-2 font-semibold">
        <HelpCircle className="h-5 w-5 md:hidden" style={{ color: 'var(--ink)' }} />
        {T.title}
      </h1>
      <div className="space-y-2">
        {sections.map((s, i) => (
          <details key={s.title} open={i === 0} className="group rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
              {s.title}
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="list-disc space-y-1.5 px-4 pb-4 pl-8 text-sm leading-relaxed text-foreground/90">
              {s.items.filter((it) => !(it.web && isNative)).map((it) => {
                const text = typeof it === 'string' ? it : it.text;
                return <li key={text}>{text}</li>;
              })}
            </ul>
          </details>
        ))}
      </div>
      <p className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/terms" className="underline">{T.terms}</Link>
        <Link to="/privacy" className="underline">{T.privacy}</Link>
      </p>
    </div>
  );
}

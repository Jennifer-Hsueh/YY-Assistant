import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandMark, { BetaTag } from '../components/BrandMark';
import { useBeta } from '../lib/useBeta';
import { useLanguage } from '../context/LanguageContext';
import LandingPlay from '../components/landing/LandingPlay';
import BeaverGuide from '../components/landing/BeaverGuide';

// 入口頁(未登入的網頁訪客看到;已登入直接進手帳首頁,APP 版直接到登入頁)
// 由上往下:開頭 → 功能一覽 → 記帳與共同帳本 → 行事曆與紀念日 → 首頁(心情、記事、小紙條)→ 社群與好友 → 主題 → 方案 → 在手機上使用
// 截圖在 public/landing/(英文版在 public/landing/en/),用示範資料產生

const COPY = {
  zh: {
    login: '登入',
    langSwitch: 'EN',
    docTitle: 'YY手帳 Assistant｜把每天的小事，好好收進手帳',
    heroTitle: ['把每天的小事，', '好好收進手帳'],
    heroText: '記帳、行事曆、紀念日和隨手記事，放在同一本手帳裡。還能和家人朋友共用帳本和行事曆、互傳小紙條，貼上生活照片，每個月再整理成一本專屬的書，放進小河狸的家。註冊後三個月免費使用全部功能，不需要信用卡。',
    cta: '免費開始使用',
    ctaFull: '測試名額已滿',
    betaLine: (limit, remaining) => `目前開放 ${limit} 位測試者，還有 ${remaining} 個名額`,
    betaFullLine: (limit) => `${limit} 位測試名額已滿，謝謝你的關注`,
    foundingLine: '🦫 測試期間使用滿 5 天，正式上線後送你一年全功能',
    peek: '看看能做什麼',
    tryIt: '先玩玩看',
    homeAlt: 'YY手帳 首頁畫面',
    overviewTitle: '一本手帳，裝得下這些',
    badge: ['3 個月', '全功能免費'],
    marquee: ['🌱 今天也辛苦了，記下一件小事就好', '☕ 慢慢來，日子會好好被收起來', '💌 想念一個人，就傳一張小紙條吧', '🌙 每一天，都值得被好好記得', '🦫 小河狸一直在這裡陪你'],
    overviewMore: [
      '現金、銀行、信用卡分帳戶記，還能依銀行查看餘額；每月總預算和分類預算一眼看清楚，外幣也能記。',
      '旅遊、合買、家用開一本共同帳本，成員都能記帳、修改，有人記一筆就會通知其他人。',
      '月檢視看整個月、週檢視排細節，行程用分類顏色區分；每週的課、每月的繳費日設成循環行程。',
      '新增行程時邀請好友，對方按「加入」就一起出現在行事曆，誰改了時間大家都會收到通知。',
      '全家或社團開一本共用行事曆，大家都能新增、修改，可以疊在一起看，也能分開切換。',
      '生日、紀念日選個小圖示，每年自動提醒，還會算出第幾週年、幾歲；好友生日也會提醒你。',
      '想到要做的事先寫下來，首頁就看得到，完成打個勾就好；按 Enter 一下就新增。',
      '寫一句話給好友或共同帳本的家人，不管對方在哪一頁都會跳出來，還能直接回一張。',
      '「晴空與雨天」聊心情、「養豬小能手」交流理財；可以匿名、只給好友看，或隱藏特定好友。',
      '每月 1 號，小河狸把上個月的記帳、行程、心情和照片整理成一本書，挑封面、寫一句話就完成。',
      '把今天的晚餐、路上的夕陽貼進手帳，寫一句話，只有自己看得到，每個月也會放進月刊。',
      '月曆、待辦、窗外天氣、相框都會跟著你的日子變；點點書櫃、檯燈和小河狸，看看會發生什麼。',
    ],
    more: '看大圖',
    showcaseTitle: '點點看，每個功能長什麼樣子',
    showcaseHint: '點上面的分類切換，或點功能卡片看大圖',
    close: '關閉',
    prev: '上一個',
    next: '下一個',
    overview: [
      ['📒', '記帳', '多帳戶、多幣別、預算'],
      ['👥', '共同帳本', '旅遊、家用一起記'],
      ['📅', '行事曆', '月／週檢視、提醒'],
      ['🤝', '共同行程', '約好的事一起看'],
      ['🗓️', '共用行事曆', '家人朋友一起排'],
      ['🎂', '紀念日', '生日、紀念日不錯過'],
      ['✍️', '墨箋絮語', '想到什麼先記下'],
      ['📝', '小紙條', '傳一句話給在乎的人'],
      ['🌦️', '社群', '聊心情、交流理財'],
      ['📚', '月刊書櫃', '每月一本專屬的書'],
      ['📷', '日常時光', '生活照片收進手帳'],
      ['🏡', '小河狸的家', '點點房間裡的小東西'],
    ],
    sections: [
      {
        key: 'ledger', tag: '記帳', title: '自己的帳，一起的帳',
        text: '現金、銀行、信用卡分帳戶記，每月預算一眼看清楚。日常、旅遊、家用分成不同帳本；旅行和朋友合買、家裡的開銷，開一本共同帳本一起記，誰記的都看得到，有人記帳就會通知其他人。',
        points: ['多本帳本', '共同帳本', '記帳推播通知', '循環記帳', '預算與統計', '多幣別'],
        shots: ['ledger', 'shared'],
      },
      {
        key: 'calendar', tag: '行事曆與紀念日', title: '日子排好，重要的日子也記得',
        text: '月檢視看整個月，週檢視排細節；每週的課、每月的繳費日設成循環行程。和朋友約好的事，邀請對方變成共同行程；全家的事，開一本共用行事曆，大家都能新增、修改，可以疊在一起看，也可以分開切換。生日和紀念日選個小圖示，每年自動提醒，還能算出第幾週年、幾歲；好友生日也會提醒你。',
        points: ['共用行事曆', '共同行程', '循環行程', '紀念日圖示', '週年與年紀', '好友生日提醒'],
        shots: ['calendar', 'anniv'],
      },
      {
        key: 'home', tag: '首頁', title: '打開手帳，今天的事都在這裡',
        text: '今天的行程、這個月花了多少、預算還剩多少，首頁一次看完。點一下記下今天的心情；想到要做的事寫進墨箋絮語，完成就打勾。收到小紙條，不管在哪一頁都會跳出來，還能直接回一張；小河狸也會提醒你朋友今天生日。',
        points: ['本日心情', '墨箋絮語', '小紙條', '小河狸提醒'],
        shots: ['home2', 'notes'],
      },
      {
        key: 'community', tag: '社群與好友', title: '想說的話，有地方說',
        text: '「晴空與雨天」聊心情、「養豬小能手」交流理財、「小編許願池」告訴我們想要的新功能。可以匿名、具名，或只給好友看；不想給某些好友看到，發文時選擇隱藏就好。用好友碼加好友，點進好友就能看他分享的文章。',
        points: ['匿名或暱稱', '僅好友可見', '隱藏好友', '好友碼與 QR Code', '使用規則與檢舉'],
        shots: ['community', 'friends'],
      },
      {
        key: 'bookshelf', tag: '月刊書櫃', title: '每個月，一本只屬於你的書',
        text: '每個月 1 號，小河狸會把上個月的記帳、行程、紀念日、心情、日常時光的照片、墨箋絮語和你發的文章，整理成一本書放上書櫃。7 號以前挑一張喜歡的封面、寫一句想對這個月說的話，就完成了；也可以下載成 PDF 好好收著。',
        points: ['每月自動整理', '挑封面', '心情與照片月曆', '海狸的話', '下載 PDF', '三款書櫃'],
        shots: ['bookshelf', 'book'],
      },
      {
        key: 'room', tag: '日常時光與小河狸的家', title: '生活的照片，有個溫暖的家',
        text: '把今天的晚餐、路上的夕陽貼進「日常時光」，寫一句話，只有你自己看得到；每個月也會放進月刊。書櫃住在「小河狸的家」：月曆是今天的日期、To Do 寫著還沒做完的事、窗外天氣跟著你的心情變、相框掛著你的照片。點一下小河狸，牠會跟你聊聊今天。',
        points: ['日常時光（完整版）', '只給自己看', '放進月刊', '窗外跟著心情變', '開關燈', '跟小河狸聊天'],
        shots: ['room', 'moments'],
      },
    ],
    themesTitle: '換一種心情的手帳',
    themesText: '七種風格隨時切換，從清爽到可愛、還有深色模式，設定一次，手機和電腦都一樣。',
    themes: ['米紙', '石墨灰', '莫蘭迪', '海洋', '少女心', '黃檸檬', '小河狸'],
    plansTitle: '先免費用三個月',
    plansText: '試用期間可以使用全部功能。試用結束後，可以繼續免費使用基本功能，或選一個適合你的方案。不會自動扣款。',
    plans: [
      ['基本功能', '記帳或行事曆二選一，每個月可以換一次'],
      ['進階 A', '記帳＋行事曆的基本功能'],
      ['進階 B', '記帳＋循環記帳、通知、本日心情、資料匯出與備份'],
      ['進階 C', '行事曆＋循環行程、通知、本日心情、資料匯出與備份'],
      ['進階 A／B／C＋社群', '上述任一方案加購社群'],
      ['完整版', '全部功能，包含社群和日常時光'],
    ],
    plansNote: '多帳本、共同帳本、共同行程、共用行事曆、紀念日、好友、小紙條、月刊書櫃與小河狸的家，目前所有方案都能使用；日常時光是完整版的功能。',
    free: '免費',
    perMonth: (m) => `${m} 元／月`,
    perYear: (y) => `年繳 ${y.toLocaleString()} 元`,
    mobileTitle: '在手機上使用',
    comingSoon: '即將推出',
    iphone: 'iPhone：用 Safari 開啟這個網站，點「分享」→「加入主畫面」。',
    android: 'Android：用 Chrome 開啟這個網站，點右上角選單 →「安裝應用程式」。',
    endTitle: '今天開始，把日子好好收起來',
    terms: '使用條款',
    privacy: '隱私權政策',
    contact: '聯絡我們',
    shotAlt: (name) => `YY手帳 ${name}畫面`,
  },
  en: {
    login: 'Log in',
    langSwitch: '中文',
    docTitle: 'YY Assistant | Every little thing, neatly in one notebook',
    heroTitle: ['Every little thing,', 'neatly in one notebook'],
    heroText: 'Budget, calendar, anniversaries and quick notes, all in one notebook. Share ledgers and calendars with family and friends, send little notes, keep photos of your days, and get each month bound into a book for Beaver’s home. Every feature is free for your first three months. No credit card needed.',
    cta: 'Start free',
    ctaFull: 'Beta is full',
    betaLine: (limit, remaining) => `Open to ${limit} beta testers, ${remaining} spots left`,
    betaFullLine: (limit) => `All ${limit} beta spots are taken. Thanks for your interest`,
    foundingLine: '🦫 Use it on 5 days during the beta, get 1 year of full access free after launch',
    peek: 'See what it does',
    tryIt: 'Try it',
    homeAlt: 'YY Assistant home screen',
    overviewTitle: 'Everything in one notebook',
    badge: ['3 months', 'all free'],
    marquee: ['🌱 You did well today. One small note is enough', '☕ Take it slow, your days are kept safe here', '💌 Missing someone? Send them a little note', '🌙 Every day deserves to be remembered', '🦫 Beaver is always here with you'],
    overviewMore: [
      'Track cash, bank and card accounts, view balances by bank, and see monthly and category budgets at a glance, in any currency.',
      'Open a shared ledger for trips, group buys or the household. Everyone can add and edit, and others get notified.',
      'Month view for the big picture, week view for details. Set weekly classes or monthly bills as repeating events.',
      'Invite friends when you add an event. Once they join, it shows on their calendar too, and changes notify everyone.',
      'Share a calendar with family or a club. Everyone can add and edit, overlay it with yours or switch between them.',
      'Pick an icon for birthdays and anniversaries. Get yearly reminders with years and ages, plus friends’ birthdays.',
      'Jot down things to do and see them on Home. Tick them off when done; press Enter to add a new one.',
      'Send a line to a friend or family member. It pops up on whatever page they are on, and they can reply right away.',
      'Share feelings or money tips. Post anonymously, to friends only, or hide a post from certain friends.',
      'On the 1st, Beaver turns last month’s money, plans, moods and photos into a book. Pick a cover, add a line, done.',
      'Add tonight’s dinner or a sunset to your notebook with a line of words. Only you can see it, and it goes into your monthly book.',
      'The calendar, to-dos, window weather and photo frame change with your days. Tap the shelf, lamp and Beaver to see what happens.',
    ],
    more: 'Take a look',
    showcaseTitle: 'Tap around and see each feature',
    showcaseHint: 'Switch with the tabs, or tap a feature card for a closer look',
    close: 'Close',
    prev: 'Previous',
    next: 'Next',
    overview: [
      ['📒', 'Ledger', 'Accounts, currencies, budgets'],
      ['👥', 'Shared ledgers', 'Trips and home, together'],
      ['📅', 'Calendar', 'Month and week views'],
      ['🤝', 'Shared events', 'Plans you both can see'],
      ['🗓️', 'Shared calendars', 'Plan as a family'],
      ['🎂', 'Anniversaries', 'Never miss a birthday'],
      ['✍️', 'Ink Notes', 'Jot it down first'],
      ['📝', 'Little notes', 'A line for someone you care about'],
      ['🌦️', 'Community', 'Feelings and money tips'],
      ['📚', 'Monthly bookshelf', 'A book of your month'],
      ['📷', 'Daily moments', 'Photos of your days'],
      ['🏡', 'Beaver’s home', 'A cozy room to explore'],
    ],
    sections: [
      {
        key: 'ledger', tag: 'Ledger', title: 'Your money, and money you share',
        text: 'Track cash, bank and credit card accounts and see your monthly budget at a glance. Keep separate ledgers for daily life, trips or home. For a trip with friends or household bills, open a shared ledger: everyone can see who recorded what, and the others get a notification.',
        points: ['Multiple ledgers', 'Shared ledgers', 'Entry notifications', 'Recurring entries', 'Budgets and stats', 'Multi-currency'],
        shots: ['ledger', 'shared'],
      },
      {
        key: 'calendar', tag: 'Calendar & anniversaries', title: 'Plan your days, remember the big ones',
        text: 'See the whole month or plan week by week, and make weekly classes or monthly bills recurring. Invite friends to turn plans into shared events, or open a shared calendar for the family where everyone can add and edit, shown together or one at a time. Give birthdays and anniversaries a little icon for yearly reminders, with years and ages counted for you. Friends’ birthdays are reminded too.',
        points: ['Shared calendars', 'Shared events', 'Recurring events', 'Anniversary icons', 'Years and ages', 'Friend birthdays'],
        shots: ['calendar', 'anniv'],
      },
      {
        key: 'home', tag: 'Home', title: 'Open it, and your day is right there',
        text: 'Today’s plans, this month’s spending and what is left in your budget, all on one page. Tap to log today’s mood, and jot to-dos in Ink Notes. New little notes pop up on any page so you can reply right away, and a little beaver reminds you when it’s a friend’s birthday.',
        points: ['Daily mood', 'Ink Notes', 'Little notes', 'Beaver reminders'],
        shots: ['home2', 'notes'],
      },
      {
        key: 'community', tag: 'Community & friends', title: 'A place to say what’s on your mind',
        text: 'Share how your day went, swap money tips, and tell us which features you want next. Post anonymously, with your nickname, or for friends only, and hide a post from certain friends when you need to. Add friends with a friend code and tap a friend to see what they share.',
        points: ['Anonymous or nickname', 'Friends only', 'Hide from friends', 'Friend code and QR', 'Rules and reporting'],
        shots: ['community', 'friends'],
      },
      {
        key: 'bookshelf', tag: 'Monthly bookshelf', title: 'Every month, a book that’s yours alone',
        text: 'On the 1st of each month, Beaver gathers last month’s spending, plans, anniversaries, moods, daily photos, Ink Notes and your posts into a book on your shelf. Pick a cover and write a line to the month before the 7th, and it’s done. You can download it as a PDF to keep.',
        points: ['Made for you monthly', 'Pick a cover', 'Moods & photos', 'Words from Beaver', 'PDF download', 'Three shelves'],
        shots: ['bookshelf', 'book'],
      },
      {
        key: 'room', tag: 'Daily moments & Beaver’s home', title: 'A cozy home for the photos of your days',
        text: 'Pin tonight’s dinner or a sunset on the way home to Daily moments, add a line, and keep it just for you. It goes into your monthly book, too. Your bookshelf lives in Beaver’s home: the calendar shows today, the To Do note counts what is left, the weather outside follows your mood, and your photo hangs in the frame. Tap Beaver for a little chat about your day.',
        points: ['Daily moments (Complete)', 'Just for you', 'In your monthly book', 'Weather follows your mood', 'Lights on and off', 'Chat with Beaver'],
        shots: ['room', 'moments'],
      },
    ],
    themesTitle: 'A notebook for every mood',
    themesText: 'Switch between seven styles anytime, from clean to cute, plus a dark mode. Set it once and it follows you on every device.',
    themes: ['Rice paper', 'Graphite', 'Morandi', 'Ocean', 'Sweetheart', 'Lemon', 'Beaver'],
    plansTitle: 'Free for your first three months',
    plansText: 'Use every feature during your trial. Afterward, keep using Basic for free, or pick the plan that fits you. Nothing renews automatically.',
    plans: [
      ['Basic', 'Budget or calendar (your choice, switch once a month)'],
      ['Plus A', 'Basic budget and calendar'],
      ['Plus B', 'Budget, recurring entries, notifications, daily mood, export and backup'],
      ['Plus C', 'Calendar, recurring events, notifications, daily mood, export and backup'],
      ['Plus A / B / C + Community', 'Any of the above plus community'],
      ['Complete', 'Everything, including community'],
    ],
    plansNote: 'Multiple and shared ledgers, shared events and calendars, anniversaries, friends, little notes, the monthly bookshelf and Beaver’s home are included in every plan for now. Daily moments is part of the Complete plan.',
    free: 'Free',
    perMonth: (m) => `NT$${m} / month`,
    perYear: (y) => `NT$${y.toLocaleString()} / year`,
    mobileTitle: 'Use it on your phone',
    comingSoon: 'Coming soon',
    iphone: 'iPhone: open this site in Safari, tap Share, then Add to Home Screen.',
    android: 'Android: open this site in Chrome, tap the menu, then Install app.',
    endTitle: 'Start keeping your days today',
    terms: 'Terms of use',
    privacy: 'Privacy policy',
    contact: 'Contact us',
    shotAlt: (name) => `YY Assistant ${name} screen`,
  },
};

const SECTION_COLOR = { ledger: '#C4553F', calendar: '#2F5E9E', home: '#A87A0E', community: '#3F8A5A', bookshelf: '#9A5B3A', room: '#7A5BA8' };
// 每一區的底色(粉彩)與標籤小圖示,讓頁面一段一段有變化
const SECTION_BG = { ledger: '#FCE9E3', calendar: '#E4EEFA', home: '#FBF1CF', community: '#E2F2E4', bookshelf: '#F7E6DA', room: '#ECE5F6' };
const SECTION_ICON = { ledger: '💰', calendar: '📅', home: '🏠', community: '💬', bookshelf: '📚', room: '🦫' };
const CARD_BG = ['#FCE9E3', '#E4EEFA', '#FBF1CF', '#E2F2E4', '#F7E6DA', '#ECE5F6'];
// 功能一覽 12 格 → 點了跳出的截圖與所屬段落(順序同 overview)
const OVERVIEW_SHOTS = [
  ['ledger', 'ledger'], ['shared', 'ledger'], ['calendar', 'calendar'], ['calendar', 'calendar'],
  ['calendar', 'calendar'], ['anniv', 'calendar'], ['notes', 'home'], ['home2', 'home'],
  ['community', 'community'], ['bookshelf', 'bookshelf'], ['moments', 'room'], ['room', 'room'],
];
// 開頭飄來飄去的小貼紙
const DOODLES = [['✨', '6%', '18%', 0], ['💰', '44%', '8%', 1.2], ['📅', '90%', '14%', 2.1], ['💌', '82%', '78%', .6], ['⭐', '3%', '82%', 1.7], ['🌸', '50%', '90%', 2.6]];

// 起伏的分隔線(上一區的顏色 → 這一區的顏色)
function Wave({ color, flip = false }) {
  return (
    <svg className={`landing-wave ${flip ? 'is-flip' : ''}`} viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 30 C 180 0, 360 60, 540 30 S 900 0, 1080 30 S 1300 60, 1440 30 L1440 60 L0 60 Z" fill={color} />
    </svg>
  );
}
const THEMES = ['default', 'grey', 'morandi', 'sport', 'macaron', 'lemon', 'beaver'];
const PRICES = [[null, null], [69, 728], [69, 728], [69, 728], [79, 848], [109, 1208]];

function Phone({ src, alt, className = '', eager = false }) {
  return (
    <div className={`landing-phone ${className}`}>
      <img src={src} alt={alt} width="390" height="844" loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </div>
  );
}

// 點功能卡片跳出的視窗:大截圖＋說明,可以左右切換
function FeatureModal({ T, idx, setIdx, shot }) {
  const item = T.overview[idx];
  const [shotName, secKey] = OVERVIEW_SHOTS[idx];
  const sec = T.sections.find((s) => s.key === secKey);
  const n = T.overview.length;
  const go = useCallback((d) => setIdx((i) => (i + d + n) % n), [n, setIdx]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIdx(null); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [go, setIdx]);
  return (
    <div className="landing-modal fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={item[1]} onClick={() => setIdx(null)}>
      <div key={idx} className="landing-modal-card relative grid max-h-[92vh] w-full max-w-3xl items-center gap-6 overflow-y-auto rounded-3xl p-5 md:grid-cols-[260px_1fr] md:p-8" style={{ background: SECTION_BG[secKey], '--sec': SECTION_COLOR[secKey] }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setIdx(null)} aria-label={T.close} className="absolute right-3 top-3 rounded-full bg-white/80 p-1.5 hover:bg-white"><X className="h-5 w-5" /></button>
        <Phone src={shot(shotName)} alt={item[1]} className="mx-auto w-[150px] md:w-[240px]" eager />
        <div>
          <p className="landing-tag mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"><span aria-hidden="true">{item[0]}</span>{item[1]}</p>
          <h3 className="landing-serif text-[22px] leading-snug md:text-[26px]" style={{ color: 'var(--ink)' }}>{item[2]}</h3>
          <p className="mt-3 text-[15px] leading-[1.85] text-foreground/80">{T.overviewMore[idx]}</p>
          <ul className="mt-4 flex flex-wrap gap-2">{sec.points.map((pt) => <li key={pt} className="landing-chip rounded-full px-3 py-1 text-sm">{pt}</li>)}</ul>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={() => go(-1)} className="landing-ghost inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold"><ChevronLeft className="h-4 w-4" />{T.prev}</button>
            <span className="text-sm text-foreground/60 tabular-nums">{idx + 1} / {n}</span>
            <button type="button" onClick={() => go(1)} className="landing-ghost inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold">{T.next}<ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CTA({ className = '', label, full = false, fullLabel }) {
  if (full) {
    return <span className={`inline-block rounded-lg border px-5 py-3 text-[15px] font-medium text-muted-foreground ${className}`} style={{ borderColor: 'rgba(51,65,92,.25)' }}>{fullLabel}</span>;
  }
  return (
    <Link to="/register" className={`landing-cta inline-block rounded-full px-6 py-3 text-[16px] font-bold ${className}`}>
      {label}
    </Link>
  );
}

export default function Landing() {
  const { language, toggleLanguage } = useLanguage();
  const beta = useBeta();
  const full = !!beta?.full;
  const T = COPY[language] || COPY.zh;
  // 截圖跟著語言切換(英文版在 public/landing/en/)
  const shot = (name) => `/landing/${language === 'en' ? 'en/' : ''}${name}.webp`;

  useEffect(() => {
    // 標題字型只在入口頁載入
    const id = 'landing-font';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id;
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;700&display=swap';
      document.head.appendChild(l);
    }
    return () => { document.title = 'YY手帳'; document.documentElement.lang = 'zh-Hant'; };
  }, []);
  useEffect(() => {
    document.title = T.docTitle;
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant';
  }, [T, language]);

  // 捲到才淡入(.reveal → .is-in);不想要動畫的人直接顯示
  useEffect(() => {
    const els = [...document.querySelectorAll('.landing .reveal')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('is-in'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [language]);

  const [modal, setModal] = useState(null); // 功能卡片跳出視窗(第幾個)
  const [tab, setTab] = useState(0); // 功能導覽目前的分類
  const [nudge, setNudge] = useState(null); // 換分類時,導覽小河狸跟著換話
  const pickTab = (i) => { setTab(i); setNudge({ key: T.sections[i].key, at: Date.now() }); };

  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  return (
    <div className="landing min-h-screen" style={{ color: 'var(--foreground)' }}>
      <header className="landing-header sticky top-0 z-30">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-2.5 md:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: smooth() })} aria-label="YY手帳"><BrandMark /></button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleLanguage} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-black/5" style={{ color: 'var(--ink)' }} lang={language === 'en' ? 'zh-Hant' : 'en'}>{T.langSwitch}</button>
            <Link to="/login" className="rounded-lg border px-4 py-2 text-base font-medium hover:bg-white/70" style={{ color: 'var(--ink)', borderColor: 'rgba(51,65,92,.25)' }}>{T.login}</Link>
          </div>
        </div>
      </header>

      <main>
        {/* 開頭 */}
        <section data-guide="hero" className="landing-hero relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-6 md:grid-cols-[1.1fr_1fr] md:px-8 md:pb-20 md:pt-12">
          {DOODLES.map(([e, x, y, d]) => (
            <span key={e} className="landing-doodle" aria-hidden="true" style={{ left: x, top: y, animationDelay: `${d}s` }}>{e}</span>
          ))}
          <div className="order-2 md:order-1">
            {beta?.active && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-foreground/75">
                <BetaTag lang={language} />
                {full ? T.betaFullLine(beta.limit) : T.betaLine(beta.limit, beta.remaining)}
              </p>
            )}
            {beta?.active && !full && <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>{T.foundingLine}</p>}
            <h1 className={`landing-serif landing-hero-title ${language === 'en' ? 'landing-hero-title-en' : ''}`} style={{ color: 'var(--ink)' }}>
              {T.heroTitle[0]}<br /><span className="landing-mark">{T.heroTitle[1]}</span>
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-[1.85] text-foreground/80 md:text-[17px]">{T.heroText}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <CTA label={T.cta} full={full} fullLabel={T.ctaFull} />
              <button type="button" onClick={() => document.getElementById('overview')?.scrollIntoView({ behavior: smooth() })} className="landing-ghost rounded-full px-4 py-2.5 text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                {T.peek} ↓
              </button>
              <button type="button" onClick={() => document.getElementById('play')?.scrollIntoView({ behavior: smooth() })} className="landing-ghost rounded-full px-4 py-2.5 text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                {T.tryIt} 🦫
              </button>
            </div>
          </div>
          <div className="relative order-1 mx-auto md:order-2">
            <span className="landing-blob landing-blob-a" aria-hidden="true" />
            <span className="landing-blob landing-blob-b" aria-hidden="true" />
            <span className="landing-tape" aria-hidden="true" />
            <span className="landing-badge" aria-hidden="true"><b>{T.badge[0]}</b><span>{T.badge[1]}</span></span>
            <Phone src={shot('home')} alt={T.homeAlt} className="landing-hero-phone w-[220px] md:w-[300px]" eager />
            {/* 小河狸從手機旁邊探出頭來 */}
            <img src="/reactions/cheer.webp" alt="" width="160" height="160" className="landing-peek absolute -left-12 bottom-10 h-20 w-20 md:-left-16 md:h-28 md:w-28" />
          </div>
        </section>

        {/* 跑馬燈:功能名稱一直往左跑 */}
        <div className="landing-marquee" aria-hidden="true">
          <div className="landing-marquee-track">
            {[...T.marquee, ...T.marquee].map((w, k) => <span key={k}>{w}</span>)}
          </div>
        </div>

        {/* 功能一覽 */}
        <section id="overview" data-guide="overview" className="landing-band scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
            <h2 className="landing-serif text-center text-[24px] md:text-[30px]" style={{ color: 'var(--ink)' }}><span className="landing-mark">{T.overviewTitle}</span></h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6">
              {T.overview.map(([emoji, name, desc], k) => (
                <li key={name} className="reveal" style={{ transitionDelay: `${(k % 6) * 70}ms` }}>
                  <button type="button" onClick={() => setModal(k)} className="landing-card landing-lift h-full w-full rounded-2xl p-4 text-left" style={{ background: CARD_BG[k % CARD_BG.length] }}>
                    <span className="landing-emoji inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl leading-none">{emoji}</span>
                    <p className="mt-2 font-semibold" style={{ color: 'var(--ink)' }}>{name}</p>
                    <p className="mt-0.5 text-sm text-foreground/70">{desc}</p>
                    <span className="landing-more mt-2 inline-block text-xs font-bold" style={{ color: 'var(--ink)' }}>{T.more} ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 試玩區:不用註冊的小互動 */}
        <LandingPlay lang={language} full={full} />

        {/* 功能導覽:點分類切換(原本六大段落,改成一區互動切換,頁面短很多) */}
        {(() => { const s = T.sections[tab]; return (
          <section data-guide={s.key} className="landing-section landing-showcase relative" style={{ background: SECTION_BG[s.key], '--sec': SECTION_COLOR[s.key] }}>
            <Wave color={SECTION_BG[s.key]} />
            <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
              <h2 className="landing-serif text-center text-[24px] md:text-[30px]" style={{ color: 'var(--ink)' }}><span className="landing-mark">{T.showcaseTitle}</span></h2>
              <div className="mt-6 flex flex-wrap justify-center gap-2" role="tablist">
                {T.sections.map((x, i) => (
                  <button key={x.key} type="button" role="tab" aria-selected={i === tab} onClick={() => pickTab(i)}
                    className={`landing-tab rounded-full px-4 py-2 text-sm font-bold ${i === tab ? 'is-on' : ''}`} style={{ '--sec': SECTION_COLOR[x.key] }}>
                    <span aria-hidden="true">{SECTION_ICON[x.key]}</span> {x.tag}
                  </button>
                ))}
              </div>
              <div key={s.key} className="landing-swap mt-10 grid items-center gap-10 md:grid-cols-2 md:gap-16">
                <div>
                  <p className="landing-tag mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"><span aria-hidden="true">{SECTION_ICON[s.key]}</span>{s.tag}</p>
                  <h3 className="landing-serif text-[26px] leading-snug md:text-[32px]" style={{ color: 'var(--ink)' }}><span className="landing-mark landing-mark-sec">{s.title}</span></h3>
                  <p className="mt-4 max-w-lg text-[15px] leading-[1.9] text-foreground/80 md:text-[16px]">{s.text}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">{s.points.map((pt) => <li key={pt} className="landing-chip rounded-full px-3 py-1 text-sm">{pt}</li>)}</ul>
                  <div className="mt-6 flex items-center gap-3">
                    <button type="button" aria-label={T.prev} onClick={() => pickTab((tab + T.sections.length - 1) % T.sections.length)} className="landing-ghost rounded-full p-2.5"><ChevronLeft className="h-5 w-5" /></button>
                    <span className="text-sm tabular-nums text-foreground/60">{tab + 1} / {T.sections.length}</span>
                    <button type="button" aria-label={T.next} onClick={() => pickTab((tab + 1) % T.sections.length)} className="landing-ghost rounded-full p-2.5"><ChevronRight className="h-5 w-5" /></button>
                  </div>
                </div>
                <div className="landing-pair">
                  <Phone src={shot(s.shots[0])} alt={T.shotAlt(s.tag)} className="landing-pair-back" eager />
                  <Phone src={shot(s.shots[1])} alt={T.shotAlt(s.tag)} className="landing-pair-front" eager />
                </div>
              </div>
            </div>
          </section>
        ); })()}

        {/* 主題 */}
        <section data-guide="themes" className="landing-band">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
            <h2 className="landing-serif text-center text-[24px] md:text-[30px]" style={{ color: 'var(--ink)' }}><span className="landing-mark">{T.themesTitle}</span></h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-[1.8] text-foreground/75">{T.themesText}</p>
            <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-7 lg:gap-4">
              {THEMES.map((th, i) => (
                <li key={th} className="landing-lift landing-tilt reveal text-center" style={{ transitionDelay: `${i * 80}ms`, '--tilt': `${i % 2 ? 2.5 : -2.5}deg` }}>
                  <div className="landing-theme"><img src={shot(`theme-${th}`)} alt={T.themes[i]} width="390" height="520" loading="lazy" decoding="async" /></div>
                  <p className="mt-2 text-sm font-medium" style={{ color: 'var(--ink)' }}>{T.themes[i]}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 方案 */}
        <section data-guide="plans" className="reveal mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
          <h2 className="landing-serif text-[26px] md:text-[34px]" style={{ color: 'var(--ink)' }}><span className="landing-mark">{T.plansTitle}</span></h2>
          <p className="mt-3 text-[15px] leading-[1.8] text-foreground/80 md:text-[16px]">{T.plansText}</p>
          <ul className="mt-6 border-t-2" style={{ borderColor: 'var(--ink)' }}>
            {T.plans.map(([name, desc], pi) => { const [m, y] = PRICES[pi]; return (
              <li key={name} className="landing-plan grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b px-2 py-3 md:grid-cols-[180px_1fr_auto]" style={{ borderColor: 'rgba(51,65,92,.15)' }}>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{name}</span>
                <span className="col-start-1 row-start-2 text-sm text-foreground/75 md:col-start-2 md:row-start-1 md:text-[15px]">{desc}</span>
                <span className="row-span-2 self-center text-right tabular-nums md:col-start-3 md:row-span-1">
                  {m ? (<><span className="block">{T.perMonth(m)}</span><span className="block text-xs text-muted-foreground">{T.perYear(y)}</span></>) : T.free}
                </span>
              </li>
            ); })}
          </ul>
          <p className="mt-4 text-sm text-foreground/70">{T.plansNote}</p>
        </section>

        {/* 結尾+在手機上使用 */}
        <section data-guide="end" className="landing-end relative overflow-hidden">
          {['💖', '✨', '🌼', '⭐', '💌', '🍀'].map((e, k) => (
            <span key={e} className="landing-float-up" aria-hidden="true" style={{ left: `${8 + k * 16}%`, animationDelay: `${k * 1.1}s` }}>{e}</span>
          ))}
          <div className="relative mx-auto max-w-3xl px-5 py-14 text-center md:px-8 md:py-20">
            <img src="/reactions/hug.webp" alt="" width="160" height="160" className="landing-bob mx-auto mb-2 h-24 w-24" />
            <h2 className="landing-serif text-[26px] md:text-[34px]" style={{ color: 'var(--ink)' }}>{T.endTitle}</h2>
            <CTA className="mt-6" label={T.cta} full={full} fullLabel={T.ctaFull} />
            <h3 className="mt-12 font-semibold" style={{ color: 'var(--ink)' }}>{T.mobileTitle}</h3>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {['App Store', 'Google Play'].map((s) => (
                <span key={s} className="flex flex-col rounded-lg border bg-white/60 px-4 py-2" style={{ borderColor: 'rgba(51,65,92,.25)' }}>
                  <span className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>{s}</span>
                  <span className="text-xs text-muted-foreground">{T.comingSoon}</span>
                </span>
              ))}
            </div>
            <ul className="mx-auto mt-5 max-w-xl space-y-1.5 text-[15px] leading-[1.8] text-foreground/80">
              <li>{T.iphone}</li>
              <li>{T.android}</li>
            </ul>
          </div>
        </section>
      </main>

      <BeaverGuide lang={language} nudge={nudge} />
      {modal !== null && <FeatureModal T={T} idx={modal} setIdx={setModal} shot={shot} />}
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-6 text-sm text-muted-foreground md:px-8">
        <Link to="/terms" className="hover:underline">{T.terms}</Link>
        <Link to="/privacy" className="hover:underline">{T.privacy}</Link>
        <a href="mailto:happybusybeaver@gmail.com" className="hover:underline">{T.contact}</a>
        <span>© 2026 YY手帳</span>
      </footer>
    </div>
  );
}

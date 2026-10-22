import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import { useLanguage } from '../context/LanguageContext';

// 入口頁(未登入的網頁訪客看到;已登入直接進手帳首頁,APP 版直接到登入頁)
// 整頁是左右滑動的幾頁:免費開始 → 四個功能 → 方案 → 在手機上使用
// 截圖在 public/landing/,用示範資料產生

// 中英文內容(右上角可切換,和 App 內的語言設定共用)
const COPY = {
  zh: {
    login: '登入',
    langSwitch: 'EN',
    docTitle: 'YY手帳 Assistant｜把每天的小事，好好收進手帳',
    heroTitle: ['把每天的小事，', '好好收進手帳'],
    heroText: '記帳、行事曆、待辦記事和一個可以聊心情的社群，放在同一本手帳裡。註冊後三個月免費使用全部功能，不需要信用卡。',
    cta: '免費開始使用',
    peek: '看看能做什麼',
    homeAlt: 'YY手帳 首頁畫面：今日行程、本月累積消費、預算使用與待辦記事',
    shotAlt: (name) => `YY手帳 ${name}畫面`,
    features: [
      { name: '記帳', title: '每一筆花費，都有它的位置', text: '現金、銀行、信用卡分帳戶記錄，分類自訂顏色。房租、訂閱這類固定收支設成循環，到期自動入帳。', points: ['列表與日曆兩種檢視', '每月預算與分類統計', '多幣別帳戶'] },
      { name: '行事曆', title: '行程排好，時間到了會提醒你', text: '月檢視一眼看完整個月，週檢視排細節。每週的課、每月的繳費日設成循環行程，不用一個一個加。', points: ['提前提醒推播', '跨日行程', '分類顏色'] },
      { name: '墨箋絮語', title: '想到什麼，先記下來', text: '買東西、回電話、預約餐廳，隨手寫一句。完成後打勾，首頁只留下還沒做的事。', points: ['首頁直接新增', '完成打勾'] },
      { name: '社群', title: '和其他手帳主人聊聊', text: '「晴空與雨天」分享心情，「養豬小能手」交流理財，「小編許願池」告訴我們想要的新功能。可以匿名發文，也可以只寫給自己。', points: ['匿名或暱稱發文', '每篇最多 3 張照片', '檢舉與管理員把關'] },
    ],
    plansTitle: '先免費用三個月',
    plansText: '試用期間可以使用全部功能。試用結束後，可以繼續免費使用基本功能，或選一個適合你的方案。不會自動扣款。',
    plans: [
      ['基本功能', '記帳或行事曆二選一，每個月可以換一次'],
      ['進階 A', '記帳＋行事曆的基本功能'],
      ['進階 B', '記帳＋循環記帳、通知、首頁圖片、本日心情、資料匯出與備份'],
      ['進階 C', '行事曆＋循環行程、通知、首頁圖片、本日心情、資料匯出與備份'],
      ['進階 A／B／C＋社群', '上述任一方案加購社群'],
      ['完整版', '全部功能，包含社群'],
    ],
    free: '免費',
    perMonth: (m) => `${m} 元／月`,
    perYear: (y) => `年繳 ${y.toLocaleString()} 元`,
    mobileTitle: '在手機上使用',
    comingSoon: '即將推出',
    iphone: 'iPhone：用 Safari 開啟這個網站，點「分享」→「加入主畫面」。',
    android: 'Android：用 Chrome 開啟這個網站，點右上角選單 →「安裝應用程式」。',
    terms: '使用條款',
    privacy: '隱私權政策',
    contact: '聯絡我們',
    pages: ['免費開始', '記帳', '行事曆', '墨箋絮語', '社群', '方案', '在手機上使用'],
    prev: '上一頁',
    next: '下一頁',
    toFirst: '回到第一頁',
    switchPage: '切換頁面',
    intro: 'YY手帳 介紹',
  },
  en: {
    login: 'Log in',
    langSwitch: '中文',
    docTitle: 'YY Assistant | Every little thing, neatly in one notebook',
    heroTitle: ['Every little thing,', 'neatly in one notebook'],
    heroText: 'Budget, calendar, to-dos, and a friendly community, all in one notebook. Every feature is free for your first three months. No credit card needed.',
    cta: 'Start free',
    peek: 'See what it does',
    homeAlt: 'YY Assistant home screen: today’s events, monthly spending, budget, and to-dos',
    shotAlt: (name) => `YY Assistant ${name} screen`,
    features: [
      { name: 'Ledger', title: 'Every expense has its place', text: 'Track cash, bank, and credit card accounts with your own color-coded categories. Set rent and subscriptions as recurring, and they are recorded automatically when due.', points: ['List and calendar views', 'Monthly budgets and category stats', 'Multi-currency accounts'] },
      { name: 'Calendar', title: 'Plan your days and get reminded on time', text: 'See the whole month at a glance, or plan the details week by week. Make weekly classes and monthly bill days recurring instead of adding them one by one.', points: ['Reminder notifications', 'Multi-day events', 'Color categories'] },
      { name: 'Ink Notes', title: 'Jot it down before you forget', text: 'Groceries, calls to return, a table to book. Write a quick line and check it off when it’s done. Your home page only shows what’s left.', points: ['Add from the home page', 'Check off when done'] },
      { name: 'Community', title: 'Chat with other notebook keepers', text: 'Share how your day went, swap money tips, and tell us which features you want next. Post anonymously, or keep a post just for yourself.', points: ['Anonymous or nickname posts', 'Up to 3 photos per post', 'Reporting and moderation'] },
    ],
    plansTitle: 'Free for your first three months',
    plansText: 'Use every feature during your trial. Afterward, keep using Basic for free, or pick the plan that fits you. Nothing renews automatically.',
    plans: [
      ['Basic', 'Budget or calendar (your choice, switch once a month)'],
      ['Plus A', 'Basic budget and calendar'],
      ['Plus B', 'Budget, recurring entries, notifications, home image, daily mood, export and backup'],
      ['Plus C', 'Calendar, recurring events, notifications, home image, daily mood, export and backup'],
      ['Plus A / B / C + Community', 'Any of the above plus community'],
      ['Complete', 'Everything, including community'],
    ],
    free: 'Free',
    perMonth: (m) => `NT$${m} / month`,
    perYear: (y) => `NT$${y.toLocaleString()} / year`,
    mobileTitle: 'Use it on your phone',
    comingSoon: 'Coming soon',
    iphone: 'iPhone: open this site in Safari, tap Share, then Add to Home Screen.',
    android: 'Android: open this site in Chrome, tap the menu, then Install app.',
    terms: 'Terms of use',
    privacy: 'Privacy policy',
    contact: 'Contact us',
    pages: ['Start free', 'Ledger', 'Calendar', 'Ink Notes', 'Community', 'Plans', 'On your phone'],
    prev: 'Previous page',
    next: 'Next page',
    toFirst: 'Back to the first page',
    switchPage: 'Change page',
    intro: 'About YY Assistant',
  },
};

const FEATURE_META = [
  { key: 'ledger', color: 'var(--expense)', shot: '/landing/ledger.webp' },
  { key: 'calendar', color: 'var(--ink)', shot: '/landing/calendar.webp' },
  { key: 'notes', color: 'var(--module-notes, #8B5E3C)', shot: '/landing/notes.webp' },
  { key: 'community', color: 'var(--income)', shot: '/landing/community.webp' },
];
const PRICES = [[null, null], [59, 608], [59, 608], [59, 608], [69, 728], [99, 1088]];

function Phone({ src, alt, className = '', eager = false }) {
  return (
    <div className={`landing-phone ${className}`}>
      <img src={src} alt={alt} width="390" height="844" loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </div>
  );
}

function CTA({ className = '', label }) {
  return (
    <Link to="/register" className={`inline-block rounded-lg px-5 py-3 text-[15px] font-medium shadow-sm ${className}`} style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
      {label}
    </Link>
  );
}

export default function Landing() {
  const deck = useRef(null);
  const [active, setActive] = useState(0);
  const { language, toggleLanguage } = useLanguage();
  const T = COPY[language] || COPY.zh;
  const PAGES = T.pages;
  // 截圖跟著語言切換(英文版在 public/landing/en/)
  const shot = (path) => (language === 'en' ? path.replace('/landing/', '/landing/en/') : path);
  const FEATURES = FEATURE_META.map((m, i) => ({ ...m, ...T.features[i], shot: shot(m.shot) }));

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

  function onScroll() {
    const el = deck.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  }
  function go(i) {
    const el = deck.current;
    if (!el) return;
    const n = Math.max(0, Math.min(PAGES.length - 1, i));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: n * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    setActive(n);
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const last = PAGES.length - 1;

  return (
    <div className="landing flex h-[100svh] flex-col overflow-hidden" style={{ color: 'var(--foreground)' }}>
      <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between px-5 py-3 md:px-8">
        <button type="button" onClick={() => go(0)} aria-label={T.toFirst}><BrandMark /></button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleLanguage} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-black/5" style={{ color: 'var(--ink)' }} lang={language === 'en' ? 'zh-Hant' : 'en'}>{T.langSwitch}</button>
          <Link to="/login" className="rounded-lg border px-4 py-2 text-base font-medium hover:bg-white/70" style={{ color: 'var(--ink)', borderColor: 'rgba(51,65,92,.25)' }}>{T.login}</Link>
        </div>
      </header>

      <main ref={deck} onScroll={onScroll} className="landing-track min-h-0 flex-1" aria-roledescription="carousel" aria-label={T.intro}>
        {/* 1. 免費開始 */}
        <section className="landing-page" aria-roledescription="slide" aria-label={`1 / ${PAGES.length}：${PAGES[0]}`}>
          <div className="landing-inner md:grid-cols-[1.15fr_1fr]">
            <div className="order-2 md:order-1">
              <h1 className={`landing-serif landing-hero-title ${language === 'en' ? 'landing-hero-title-en' : ''}`} style={{ color: 'var(--ink)' }}>
                {T.heroTitle[0]}<br />{T.heroTitle[1]}
              </h1>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-foreground/80 md:mt-5 md:text-[17px]">
                {T.heroText}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <CTA label={T.cta} />
                <button type="button" onClick={() => go(1)} className="flex items-center gap-1 rounded-lg px-3 py-3 text-[15px] font-medium hover:bg-black/5" style={{ color: 'var(--ink)' }}>
                  {T.peek}<ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="relative order-1 mx-auto md:order-2">
              <span className="landing-tape" aria-hidden="true" />
              <Phone src={shot('/landing/home.webp')} alt={T.homeAlt} className="landing-deck-phone landing-hero-phone" eager />
            </div>
          </div>
        </section>

        {/* 2–5. 功能 */}
        {FEATURES.map((f, i) => (
          <section key={f.key} className="landing-page" aria-roledescription="slide" aria-label={`${i + 2} / ${PAGES.length}：${f.name}`}>
            <div className="landing-inner md:grid-cols-2">
              <div className="order-2 md:order-1">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium md:mb-3" style={{ color: f.color }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                  {f.name}
                </p>
                <h2 className="landing-serif text-[24px] leading-snug md:text-[32px]" style={{ color: 'var(--ink)' }}>{f.title}</h2>
                <p className="mt-3 max-w-md text-[15px] leading-[1.8] text-foreground/80 md:mt-4 md:text-[16px]">{f.text}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {f.points.map((pt) => (
                    <li key={pt} className="rounded-full border px-3 py-1 text-sm text-foreground/75" style={{ borderColor: 'rgba(51,65,92,.2)', background: 'rgba(255,255,255,.55)' }}>{pt}</li>
                  ))}
                </ul>
              </div>
              <Phone src={f.shot} alt={T.shotAlt(f.name)} className="landing-deck-phone order-1 mx-auto md:order-2" />
            </div>
          </section>
        ))}

        {/* 6. 方案 */}
        <section className="landing-page" aria-roledescription="slide" aria-label={`${PAGES.length - 1} / ${PAGES.length}：${PAGES[5]}`}>
          <div className="landing-inner landing-inner-text">
            <h2 className="landing-serif text-[24px] md:text-[32px]" style={{ color: 'var(--ink)' }}>{T.plansTitle}</h2>
            <p className="mt-3 max-w-xl text-[15px] leading-[1.8] text-foreground/80 md:text-[16px]">
              {T.plansText}
            </p>
            <ul className="mt-5 border-t-2" style={{ borderColor: 'var(--ink)' }}>
              {T.plans.map(([name, desc], pi) => { const [m, y] = PRICES[pi]; return (
                <li key={name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b py-3 md:grid-cols-[180px_1fr_auto]" style={{ borderColor: 'rgba(51,65,92,.15)' }}>
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>{name}</span>
                  <span className="col-start-1 row-start-2 text-sm text-foreground/75 md:col-start-2 md:row-start-1 md:text-[15px]">{desc}</span>
                  <span className="row-span-2 self-center text-right tabular-nums md:row-span-1 md:col-start-3">
                    {m ? (<><span className="block">{T.perMonth(m)}</span><span className="block text-xs text-muted-foreground">{T.perYear(y)}</span></>) : T.free}
                  </span>
                </li>
              ); })}
            </ul>
          </div>
        </section>

        {/* 7. 在手機上使用 */}
        <section className="landing-page" aria-roledescription="slide" aria-label={`${PAGES.length} / ${PAGES.length}：${PAGES[6]}`}>
          <div className="landing-inner landing-inner-text">
            <h2 className="landing-serif text-[24px] md:text-[32px]" style={{ color: 'var(--ink)' }}>{T.mobileTitle}</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {['App Store', 'Google Play'].map((s) => (
                <span key={s} className="flex flex-col rounded-lg border px-4 py-2" style={{ borderColor: 'rgba(51,65,92,.25)' }}>
                  <span className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>{s}</span>
                  <span className="text-xs text-muted-foreground">{T.comingSoon}</span>
                </span>
              ))}
            </div>
            <ul className="mt-5 max-w-xl space-y-2 text-[15px] leading-[1.8] text-foreground/80 md:text-[16px]">
              <li>{T.iphone}</li>
              <li>{T.android}</li>
            </ul>
            <CTA className="mt-7" label={T.cta} />
            <nav className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <Link to="/terms" className="hover:underline">{T.terms}</Link>
              <Link to="/privacy" className="hover:underline">{T.privacy}</Link>
              <a href="mailto:happybusybeaver@gmail.com" className="hover:underline">{T.contact}</a>
              <span>© 2026 YY手帳</span>
            </nav>
          </div>
        </section>
      </main>

      {/* 底部導覽:上一頁/下一頁、目前頁名、頁數點 */}
      <nav className="shrink-0 border-t border-dashed" style={{ borderColor: 'rgba(51,65,92,.18)' }} aria-label={T.switchPage}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <button type="button" aria-label={T.prev} onClick={() => go(active - 1)} disabled={active === 0} className="landing-arrow"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }} aria-live="polite">{PAGES[active]}</span>
            <div className="flex gap-1.5">
              {PAGES.map((name, i) => (
                <button key={name} type="button" aria-label={name} aria-current={active === i ? 'true' : undefined} onClick={() => go(i)}
                  className="h-1.5 rounded-full transition-all" style={{ width: active === i ? 20 : 6, background: active === i ? 'var(--ink)' : 'rgba(51,65,92,.25)' }} />
              ))}
            </div>
          </div>
          <button type="button" aria-label={T.next} onClick={() => go(active + 1)} disabled={active === last} className="landing-arrow"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </nav>
    </div>
  );
}

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import BrandMark, { BetaTag } from '../components/BrandMark';
import { useBeta } from '../lib/useBeta';
import { useLanguage } from '../context/LanguageContext';

// 入口頁(未登入的網頁訪客看到;已登入直接進手帳首頁,APP 版直接到登入頁)
// 由上往下:開頭 → 功能一覽 → 記帳與共同帳本 → 行事曆與紀念日 → 首頁(心情、記事、小紙條)→ 社群與好友 → 主題 → 方案 → 在手機上使用
// 截圖在 public/landing/(英文版在 public/landing/en/),用示範資料產生

const COPY = {
  zh: {
    login: '登入',
    langSwitch: 'EN',
    docTitle: 'YY手帳 Assistant｜把每天的小事，好好收進手帳',
    heroTitle: ['把每天的小事，', '好好收進手帳'],
    heroText: '記帳、行事曆、紀念日和隨手記事，放在同一本手帳裡。還能和家人朋友共用帳本、一起排行程、互傳小紙條。註冊後三個月免費使用全部功能，不需要信用卡。',
    cta: '免費開始使用',
    ctaFull: '測試名額已滿',
    betaLine: (limit, remaining) => `目前開放 ${limit} 位測試者，還有 ${remaining} 個名額`,
    betaFullLine: (limit) => `${limit} 位測試名額已滿，謝謝你的關注`,
    foundingLine: '🦫 測試期間使用滿 5 天，正式上線後送你一年全功能',
    peek: '看看能做什麼',
    homeAlt: 'YY手帳 首頁畫面',
    overviewTitle: '一本手帳，裝得下這些',
    overview: [
      ['📒', '記帳', '多帳戶、多幣別、預算'],
      ['👥', '共同帳本', '旅遊、家用一起記'],
      ['📅', '行事曆', '月／週檢視、提醒'],
      ['🤝', '共同行程', '約好的事一起看'],
      ['🎂', '紀念日', '生日、紀念日不錯過'],
      ['✍️', '墨箋絮語', '想到什麼先記下'],
      ['📝', '小紙條', '傳一句話給在乎的人'],
      ['🌦️', '社群', '聊心情、交流理財'],
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
        text: '月檢視看整個月，週檢視排細節；每週的課、每月的繳費日設成循環行程。和朋友約好的事，邀請對方變成共同行程。生日和紀念日選個小圖示，每年自動提醒，還能算出第幾週年、幾歲；好友生日也會提醒你。',
        points: ['共同行程', '循環行程', '紀念日圖示', '週年與年紀', '好友生日提醒'],
        shots: ['calendar', 'anniv'],
      },
      {
        key: 'home', tag: '首頁', title: '打開手帳，今天的事都在這裡',
        text: '今天的行程、這個月花了多少、預算還剩多少，首頁一次看完。點一下記下今天的心情；想到要做的事寫進墨箋絮語，完成就打勾。收到小紙條會跳出來給你看，小河狸也會提醒你朋友今天生日。',
        points: ['本日心情', '墨箋絮語', '小紙條', '小河狸提醒'],
        shots: ['home2', 'notes'],
      },
      {
        key: 'community', tag: '社群與好友', title: '想說的話，有地方說',
        text: '「晴空與雨天」聊心情、「養豬小能手」交流理財、「小編許願池」告訴我們想要的新功能。可以匿名、具名，或只給好友看；不想給某些好友看到，發文時選擇隱藏就好。用好友碼加好友，點進好友就能看他分享的文章。',
        points: ['匿名或暱稱', '僅好友可見', '隱藏好友', '好友碼與 QR Code', '使用規則與檢舉'],
        shots: ['community', 'friends'],
      },
    ],
    themesTitle: '換一種心情的手帳',
    themesText: '四種風格隨時切換，設定一次，手機和電腦都一樣。',
    themes: ['米紙', '石墨灰', '莫蘭迪', '運動風'],
    plansTitle: '先免費用三個月',
    plansText: '試用期間可以使用全部功能。試用結束後，可以繼續免費使用基本功能，或選一個適合你的方案。不會自動扣款。',
    plans: [
      ['基本功能', '記帳或行事曆二選一，每個月可以換一次'],
      ['進階 A', '記帳＋行事曆的基本功能'],
      ['進階 B', '記帳＋循環記帳、通知、本日心情、資料匯出與備份'],
      ['進階 C', '行事曆＋循環行程、通知、本日心情、資料匯出與備份'],
      ['進階 A／B／C＋社群', '上述任一方案加購社群'],
      ['完整版', '全部功能，包含社群'],
    ],
    plansNote: '多帳本、共同帳本、共同行程、紀念日、好友與小紙條，目前所有方案都能使用。',
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
    heroText: 'Budget, calendar, anniversaries and quick notes, all in one notebook. Share ledgers with family and friends, plan events together, and send little notes. Every feature is free for your first three months. No credit card needed.',
    cta: 'Start free',
    ctaFull: 'Beta is full',
    betaLine: (limit, remaining) => `Open to ${limit} beta testers, ${remaining} spots left`,
    betaFullLine: (limit) => `All ${limit} beta spots are taken. Thanks for your interest`,
    foundingLine: '🦫 Use it on 5 days during the beta, get 1 year of full access free after launch',
    peek: 'See what it does',
    homeAlt: 'YY Assistant home screen',
    overviewTitle: 'Everything in one notebook',
    overview: [
      ['📒', 'Ledger', 'Accounts, currencies, budgets'],
      ['👥', 'Shared ledgers', 'Trips and home, together'],
      ['📅', 'Calendar', 'Month and week views'],
      ['🤝', 'Shared events', 'Plans you both can see'],
      ['🎂', 'Anniversaries', 'Never miss a birthday'],
      ['✍️', 'Ink Notes', 'Jot it down first'],
      ['📝', 'Little notes', 'A line for someone you care about'],
      ['🌦️', 'Community', 'Feelings and money tips'],
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
        text: 'See the whole month or plan week by week, and make weekly classes or monthly bills recurring. Invite friends to turn plans into shared events. Give birthdays and anniversaries a little icon for yearly reminders, with years and ages counted for you. Friends’ birthdays are reminded too.',
        points: ['Shared events', 'Recurring events', 'Anniversary icons', 'Years and ages', 'Friend birthdays'],
        shots: ['calendar', 'anniv'],
      },
      {
        key: 'home', tag: 'Home', title: 'Open it, and your day is right there',
        text: 'Today’s plans, this month’s spending and what is left in your budget, all on one page. Tap to log today’s mood, and jot to-dos in Ink Notes. New little notes pop up for you, and a little beaver reminds you when it’s a friend’s birthday.',
        points: ['Daily mood', 'Ink Notes', 'Little notes', 'Beaver reminders'],
        shots: ['home2', 'notes'],
      },
      {
        key: 'community', tag: 'Community & friends', title: 'A place to say what’s on your mind',
        text: 'Share how your day went, swap money tips, and tell us which features you want next. Post anonymously, with your nickname, or for friends only, and hide a post from certain friends when you need to. Add friends with a friend code and tap a friend to see what they share.',
        points: ['Anonymous or nickname', 'Friends only', 'Hide from friends', 'Friend code and QR', 'Rules and reporting'],
        shots: ['community', 'friends'],
      },
    ],
    themesTitle: 'A notebook for every mood',
    themesText: 'Switch between four styles anytime. Set it once and it follows you on every device.',
    themes: ['Rice paper', 'Graphite', 'Morandi', 'Sporty'],
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
    plansNote: 'Multiple and shared ledgers, shared events, anniversaries, friends and little notes are included in every plan for now.',
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

const SECTION_COLOR = { ledger: 'var(--expense)', calendar: 'var(--ink)', home: '#B8901F', community: 'var(--income)' };
const THEMES = ['default', 'grey', 'morandi', 'sport'];
const PRICES = [[null, null], [69, 728], [69, 728], [69, 728], [79, 848], [109, 1208]];

function Phone({ src, alt, className = '', eager = false }) {
  return (
    <div className={`landing-phone ${className}`}>
      <img src={src} alt={alt} width="390" height="844" loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </div>
  );
}

function CTA({ className = '', label, full = false, fullLabel }) {
  if (full) {
    return <span className={`inline-block rounded-lg border px-5 py-3 text-[15px] font-medium text-muted-foreground ${className}`} style={{ borderColor: 'rgba(51,65,92,.25)' }}>{fullLabel}</span>;
  }
  return (
    <Link to="/register" className={`inline-block rounded-lg px-5 py-3 text-[15px] font-medium shadow-sm ${className}`} style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
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
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-6 md:grid-cols-[1.1fr_1fr] md:px-8 md:pb-20 md:pt-12">
          <div className="order-2 md:order-1">
            {beta?.active && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-foreground/75">
                <BetaTag lang={language} />
                {full ? T.betaFullLine(beta.limit) : T.betaLine(beta.limit, beta.remaining)}
              </p>
            )}
            {beta?.active && !full && <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>{T.foundingLine}</p>}
            <h1 className={`landing-serif landing-hero-title ${language === 'en' ? 'landing-hero-title-en' : ''}`} style={{ color: 'var(--ink)' }}>
              {T.heroTitle[0]}<br />{T.heroTitle[1]}
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-[1.85] text-foreground/80 md:text-[17px]">{T.heroText}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <CTA label={T.cta} full={full} fullLabel={T.ctaFull} />
              <button type="button" onClick={() => document.getElementById('overview')?.scrollIntoView({ behavior: smooth() })} className="rounded-lg px-3 py-3 text-[15px] font-medium hover:bg-black/5" style={{ color: 'var(--ink)' }}>
                {T.peek} ↓
              </button>
            </div>
          </div>
          <div className="relative order-1 mx-auto md:order-2">
            <span className="landing-tape" aria-hidden="true" />
            <Phone src={shot('home')} alt={T.homeAlt} className="landing-hero-phone w-[220px] md:w-[300px]" eager />
          </div>
        </section>

        {/* 功能一覽 */}
        <section id="overview" className="landing-band scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
            <h2 className="landing-serif text-center text-[24px] md:text-[30px]" style={{ color: 'var(--ink)' }}>{T.overviewTitle}</h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {T.overview.map(([emoji, name, desc]) => (
                <li key={name} className="landing-card rounded-2xl p-4">
                  <span className="text-2xl leading-none">{emoji}</span>
                  <p className="mt-2 font-semibold" style={{ color: 'var(--ink)' }}>{name}</p>
                  <p className="mt-0.5 text-sm text-foreground/70">{desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 各功能介紹:圖文左右交錯 */}
        {T.sections.map((s, i) => (
          <section key={s.key} className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className={i % 2 ? 'md:order-2' : ''}>
                <p className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: SECTION_COLOR[s.key] }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SECTION_COLOR[s.key] }} />
                  {s.tag}
                </p>
                <h2 className="landing-serif text-[26px] leading-snug md:text-[34px]" style={{ color: 'var(--ink)' }}>{s.title}</h2>
                <p className="mt-4 max-w-lg text-[15px] leading-[1.9] text-foreground/80 md:text-[16px]">{s.text}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {s.points.map((pt) => (
                    <li key={pt} className="rounded-full border px-3 py-1 text-sm text-foreground/75" style={{ borderColor: 'rgba(51,65,92,.2)', background: 'rgba(255,255,255,.6)' }}>{pt}</li>
                  ))}
                </ul>
              </div>
              <div className={`landing-pair ${i % 2 ? 'md:order-1' : ''}`}>
                <Phone src={shot(s.shots[0])} alt={T.shotAlt(s.tag)} className="landing-pair-back" />
                <Phone src={shot(s.shots[1])} alt={T.shotAlt(s.tag)} className="landing-pair-front" />
              </div>
            </div>
          </section>
        ))}

        {/* 主題 */}
        <section className="landing-band">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
            <h2 className="landing-serif text-center text-[24px] md:text-[30px]" style={{ color: 'var(--ink)' }}>{T.themesTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-[1.8] text-foreground/75">{T.themesText}</p>
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {THEMES.map((th, i) => (
                <li key={th} className="text-center">
                  <div className="landing-theme"><img src={shot(`theme-${th}`)} alt={T.themes[i]} width="390" height="520" loading="lazy" decoding="async" /></div>
                  <p className="mt-2 text-sm font-medium" style={{ color: 'var(--ink)' }}>{T.themes[i]}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 方案 */}
        <section className="mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
          <h2 className="landing-serif text-[26px] md:text-[34px]" style={{ color: 'var(--ink)' }}>{T.plansTitle}</h2>
          <p className="mt-3 text-[15px] leading-[1.8] text-foreground/80 md:text-[16px]">{T.plansText}</p>
          <ul className="mt-6 border-t-2" style={{ borderColor: 'var(--ink)' }}>
            {T.plans.map(([name, desc], pi) => { const [m, y] = PRICES[pi]; return (
              <li key={name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b py-3 md:grid-cols-[180px_1fr_auto]" style={{ borderColor: 'rgba(51,65,92,.15)' }}>
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
        <section className="landing-band">
          <div className="mx-auto max-w-3xl px-5 py-14 text-center md:px-8 md:py-20">
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

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-6 text-sm text-muted-foreground md:px-8">
        <Link to="/terms" className="hover:underline">{T.terms}</Link>
        <Link to="/privacy" className="hover:underline">{T.privacy}</Link>
        <a href="mailto:happybusybeaver@gmail.com" className="hover:underline">{T.contact}</a>
        <span>© 2026 YY手帳</span>
      </footer>
    </div>
  );
}

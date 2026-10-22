import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// 入口頁(未登入的網頁訪客看到;已登入直接進手帳首頁,APP 版直接到登入頁)
// 截圖在 public/landing/,用示範資料產生

const FEATURES = [
  {
    key: 'ledger',
    color: 'var(--expense)',
    name: '記帳',
    title: '每一筆花費，都有它的位置',
    text: '現金、銀行、信用卡分帳戶記錄，分類自訂顏色。房租、訂閱這類固定收支設成循環，到期自動入帳。',
    points: ['列表與日曆兩種檢視', '每月預算與分類統計', '多幣別帳戶'],
    shot: '/landing/ledger.webp',
  },
  {
    key: 'calendar',
    color: 'var(--ink)',
    name: '行事曆',
    title: '行程排好，時間到了會提醒你',
    text: '月檢視一眼看完整個月，週檢視排細節。每週的課、每月的繳費日設成循環行程，不用一個一個加。',
    points: ['提前提醒推播', '跨日行程', '分類顏色'],
    shot: '/landing/calendar.webp',
  },
  {
    key: 'notes',
    color: 'var(--module-notes, #8B5E3C)',
    name: '墨箋絮語',
    title: '想到什麼，先記下來',
    text: '買東西、回電話、預約餐廳，隨手寫一句。完成後打勾，首頁只留下還沒做的事。',
    points: ['首頁直接新增', '完成打勾'],
    shot: '/landing/notes.webp',
  },
  {
    key: 'community',
    color: 'var(--income)',
    name: '社群',
    title: '和其他手帳主人聊聊',
    text: '「晴空與雨天」分享心情，「養豬小能手」交流理財，「小編許願池」告訴我們想要的新功能。可以匿名發文，也可以只寫給自己。',
    points: ['匿名或暱稱發文', '每篇最多 3 張照片', '檢舉與管理員把關'],
    shot: '/landing/community.webp',
  },
];

const PLANS = [
  ['進階 A', '記帳＋行事曆的基本功能', 59, 608],
  ['進階 B', '記帳＋循環記帳、通知、首頁圖片、本日心情、資料匯出與備份', 59, 608],
  ['進階 C', '行事曆＋循環行程、通知、首頁圖片、本日心情、資料匯出與備份', 59, 608],
  ['進階 A／B／C＋社群', '上述任一方案加購社群', 69, 728],
  ['完整版', '全部功能，包含社群', 99, 1088],
];

function Phone({ src, alt, className = '' }) {
  return (
    <div className={`landing-phone ${className}`}>
      <img src={src} alt={alt} width="390" height="844" loading="lazy" decoding="async" />
    </div>
  );
}

export default function Landing() {
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
    document.title = 'YY手帳 — 把每天的小事，好好收進手帳';
    return () => { document.title = 'YY手帳'; };
  }, []);

  return (
    <div className="landing min-h-screen" style={{ color: 'var(--foreground)' }}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/round-logo.png" alt="" className="h-11 w-11" />
          <span className="landing-serif text-lg" style={{ color: 'var(--ink)' }}>YY手帳</span>
        </Link>
        <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-black/5" style={{ color: 'var(--ink)' }}>登入</Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pt-8 pb-16 md:grid-cols-[1.15fr_1fr] md:gap-6 md:px-8 md:pt-16 md:pb-24">
          <div>
            <h1 className="landing-serif landing-hero-title" style={{ color: 'var(--ink)' }}>
              把每天的小事，<br />好好收進手帳
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-foreground/80">
              記帳、行事曆、待辦記事和一個可以聊心情的社群，放在同一本手帳裡。手機和電腦都能用，資料隨時同步。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="rounded-lg px-5 py-3 text-[15px] font-medium shadow-sm" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                免費開始使用
              </Link>
              <Link to="/login" className="rounded-lg px-4 py-3 text-[15px] font-medium hover:bg-black/5" style={{ color: 'var(--ink)' }}>
                我已經有帳號
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">註冊後三個月免費使用全部功能，不需要信用卡。</p>
          </div>
          <div className="relative mx-auto w-[min(78vw,300px)] md:w-[320px]">
            <span className="landing-tape" aria-hidden="true" />
            <Phone src="/landing/home.webp" alt="YY手帳 首頁畫面：今日行程、本月累積消費、預算使用與待辦記事" className="landing-hero-phone" />
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-5 md:px-8">
          {FEATURES.map((f, i) => (
            <section key={f.key} className={`grid items-center gap-8 border-t border-dashed py-14 md:grid-cols-2 md:gap-16 md:py-20 ${i % 2 ? 'md:[&>*:first-child]:order-2' : ''}`} style={{ borderColor: 'rgba(51,65,92,.18)' }}>
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: f.color }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                  {f.name}
                </p>
                <h2 className="landing-serif text-[26px] leading-snug md:text-[30px]" style={{ color: 'var(--ink)' }}>{f.title}</h2>
                <p className="mt-4 max-w-md text-[16px] leading-[1.85] text-foreground/80">{f.text}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {f.points.map((pt) => (
                    <li key={pt} className="rounded-full border px-3 py-1 text-sm text-foreground/75" style={{ borderColor: 'rgba(51,65,92,.2)', background: 'rgba(255,255,255,.55)' }}>{pt}</li>
                  ))}
                </ul>
              </div>
              <Phone src={f.shot} alt={`YY手帳 ${f.name}畫面`} className="mx-auto w-[min(70vw,270px)]" />
            </section>
          ))}
        </div>

        <section className="border-y border-dashed" style={{ borderColor: 'rgba(51,65,92,.18)', background: 'rgba(255,255,255,.45)' }}>
          <div className="mx-auto max-w-5xl px-5 py-14 md:px-8 md:py-20">
            <h2 className="landing-serif text-[26px] md:text-[30px]" style={{ color: 'var(--ink)' }}>先免費用三個月</h2>
            <p className="mt-3 max-w-xl text-[16px] leading-[1.85] text-foreground/80">
              試用期間可以使用全部功能。試用結束後，可以繼續免費使用基本功能（記帳或行事曆二選一），或選一個適合你的方案。不會自動扣款。
            </p>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
                <thead>
                  <tr className="border-b-2 text-sm text-muted-foreground" style={{ borderColor: 'var(--ink)' }}>
                    <th className="py-2.5 pr-4 font-medium">方案</th>
                    <th className="py-2.5 pr-4 font-medium">內容</th>
                    <th className="py-2.5 pr-4 text-right font-medium">月繳</th>
                    <th className="py-2.5 text-right font-medium">年繳</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b" style={{ borderColor: 'rgba(51,65,92,.15)' }}>
                    <td className="py-3 pr-4 font-medium" style={{ color: 'var(--ink)' }}>基本功能</td>
                    <td className="py-3 pr-4 text-foreground/80">記帳或行事曆二選一，每個月可以換一次</td>
                    <td className="py-3 pr-4 text-right" colSpan={2}>免費</td>
                  </tr>
                  {PLANS.map(([name, desc, m, y]) => (
                    <tr key={name} className="border-b" style={{ borderColor: 'rgba(51,65,92,.15)' }}>
                      <td className="whitespace-nowrap py-3 pr-4 font-medium" style={{ color: 'var(--ink)' }}>{name}</td>
                      <td className="py-3 pr-4 text-foreground/80">{desc}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">{m} 元</td>
                      <td className="whitespace-nowrap py-3 text-right tabular-nums">{y.toLocaleString()} 元</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-14 md:px-8 md:py-20">
          <h2 className="landing-serif text-[26px] md:text-[30px]" style={{ color: 'var(--ink)' }}>在手機上使用</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {['App Store', 'Google Play'].map((s) => (
              <span key={s} className="flex flex-col rounded-lg border px-4 py-2" style={{ borderColor: 'rgba(51,65,92,.25)' }}>
                <span className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>{s}</span>
                <span className="text-xs text-muted-foreground">即將推出</span>
              </span>
            ))}
          </div>
          <ul className="mt-6 max-w-xl space-y-2 text-[16px] leading-[1.8] text-foreground/80">
            <li>iPhone：用 Safari 開啟這個網站，點「分享」→「加入主畫面」。</li>
            <li>Android：用 Chrome 開啟這個網站，點右上角選單 →「安裝應用程式」。</li>
          </ul>
          <Link to="/register" className="mt-8 inline-block rounded-lg px-5 py-3 text-[15px] font-medium shadow-sm" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            免費開始使用
          </Link>
        </section>
      </main>

      <footer className="border-t" style={{ borderColor: 'rgba(51,65,92,.15)' }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>© 2026 YY手帳</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/terms" className="hover:underline">使用條款</Link>
            <Link to="/privacy" className="hover:underline">隱私權政策</Link>
            <a href="mailto:happybusybeaver@gmail.com" className="hover:underline">聯絡我們</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

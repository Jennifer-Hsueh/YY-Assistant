import { lazy, Suspense, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MOODS } from '../../lib/moods';

const PlayBook = lazy(() => import('./PlayBook'));

// 介紹頁「試玩區」:不用註冊,在瀏覽器裡玩幾個小互動(不會連到後端、不會存資料)
const COPY = {
  zh: {
    title: '先玩玩看，不用註冊',
    text: '這裡的東西都只在你的瀏覽器裡，關掉就消失，放心亂按。',
    tabs: [['mood', '☀️', '今天的心情'], ['slip', '📝', '寫紙條給小河狸'], ['ledger', '💰', '記一筆'], ['book', '📖', '翻月刊']],
    moodAsk: '今天心情怎麼樣？點一個看看',
    moodSay: {
      sunny: '今天天氣真好，記得出去走走！', love: '被愛包圍的一天，好好收藏起來 💕', flower: '像花一樣綻放的一天 🌸',
      cloudy: '陰陰的也沒關係，慢慢來就好。', rainy: '下雨的日子，給你一個抱抱。', storm: '狂風暴雨的時候，小河狸陪著你。',
      angry: '生氣也沒關係，深呼吸，先喝口水。', question: '有點迷惘嗎？寫下來會比較清楚喔。', exclaim: '發生什麼大事了！快記到手帳裡！',
    },
    slipAsk: '寫一句話給小河狸（最多 25 字）',
    slipPh: '今天也辛苦了…',
    send: '傳出去',
    flying: '紙條飛出去了…',
    replyFrom: '小河狸回了你一張',
    again: '再寫一張',
    replies: ['收到你的紙條了，今天也辛苦了 🦫', '謝謝你！我把它貼在冰箱上了', '要記得喝水喔～', '你寫的字好可愛，我收藏起來了', '明天也一起慢慢加油！', '抱一個！有空常來找我玩'],
    cats: [['餐飲', '#D9822B'], ['交通', '#4C7A9E'], ['購物', '#B9575E'], ['娛樂', '#8E6BB0']],
    seed: [['餐飲', 85, '早餐'], ['交通', 30, '公車']],
    amountPh: '金額',
    notePh: '備註（可不填）',
    add: '記一筆',
    budget: '本月預算',
    today: '今天記的',
    saved: '記好了！',
    reset: '清空',
    book: { prev: '上一頁', next: '下一頁', hint: '點書本翻頁。真正的月刊會用你自己這個月的紀錄做成。' },
    loading: '載入中…',
    cta: '喜歡的話，免費註冊開始用',
  },
  en: {
    title: 'Try it first, no sign-up',
    text: 'Everything here stays in your browser and disappears when you close it. Tap away.',
    tabs: [['mood', '☀️', "Today's mood"], ['slip', '📝', 'Write to Beaver'], ['ledger', '💰', 'Log a spend'], ['book', '📖', 'Flip a book']],
    moodAsk: 'How are you feeling today? Pick one',
    moodSay: {
      sunny: 'What a lovely day. Go take a walk!', love: 'A day full of love. Keep it close 💕', flower: 'You are blooming today 🌸',
      cloudy: 'Cloudy is okay. Take it slow.', rainy: 'Rainy day? Here is a hug.', storm: 'Beaver is here with you through the storm.',
      angry: 'It is okay to be mad. Breathe, and have some water.', question: 'Feeling lost? Writing it down helps.', exclaim: 'Something big happened! Write it down!',
    },
    slipAsk: 'Write Beaver a note (up to 25 characters)',
    slipPh: 'You did great today…',
    send: 'Send',
    flying: 'Your note is on its way…',
    replyFrom: 'Beaver wrote back',
    again: 'Write another',
    replies: ['Got your note. You did great today 🦫', 'Thank you! It is on my fridge now', 'Remember to drink some water~', 'Your handwriting is so cute', 'Let’s keep going tomorrow, slowly!', 'Hug! Come play again soon'],
    cats: [['Dining', '#D9822B'], ['Transport', '#4C7A9E'], ['Shopping', '#B9575E'], ['Fun', '#8E6BB0']],
    seed: [['Dining', 85, 'Breakfast'], ['Transport', 30, 'Bus']],
    amountPh: 'Amount',
    notePh: 'Note (optional)',
    add: 'Add',
    budget: 'Monthly budget',
    today: 'Logged today',
    saved: 'Saved!',
    reset: 'Clear',
    book: { prev: 'Previous page', next: 'Next page', hint: 'Tap the book to turn pages. Your real book is made from your own month.' },
    loading: 'Loading…',
    cta: 'Like it? Sign up free',
  },
};

const MOOD_IMG = { sunny: 'cheer', love: 'hug', flower: 'approve', cloudy: 'understand', rainy: 'hug', storm: 'hug', angry: 'understand', question: 'laugh', exclaim: 'laugh' };
const MAX = 25;
const BUDGET = 6000;
const SPENT_BEFORE = 3120; // 這個月之前已經花的(範例)
const len = (s) => [...s].length;

function MoodPlay({ T }) {
  const [mood, setMood] = useState(null);
  return (
    <div className="text-center">
      <p className="text-[15px] text-foreground/80">{T.moodAsk}</p>
      <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">
        {MOODS.map((m) => (
          <button key={m.key} type="button" onClick={() => setMood(m.key)} aria-label={m.key} className={`play-mood ${mood === m.key ? 'is-on' : ''}`}>{m.emoji}</button>
        ))}
      </div>
      <div className="mt-6 flex min-h-[132px] items-end justify-center gap-3">
        {mood && (
          <div key={mood} className="slip-pop flex items-end gap-2 text-left">
            <img src={`/reactions/${MOOD_IMG[mood]}.webp`} alt="" className="play-bounce h-24 w-24 shrink-0 drop-shadow" />
            <div className="relative mb-8 max-w-[220px] rounded-2xl border bg-white px-3 py-2 text-[15px] leading-snug shadow" style={{ borderColor: 'rgba(51,65,92,.15)' }}>
              <span className="absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 border-b border-l bg-white" style={{ borderColor: 'rgba(51,65,92,.15)' }} />
              {T.moodSay[mood]}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlipPlay({ T }) {
  const [text, setText] = useState('');
  const [stage, setStage] = useState('write'); // write → flying → reply
  const [sent, setSent] = useState('');
  const [reply, setReply] = useState('');
  const last = useRef(-1);
  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSent(text.trim());
    setStage('flying');
    let k = Math.floor(Math.random() * T.replies.length);
    if (k === last.current) k = (k + 1) % T.replies.length;
    last.current = k;
    setReply(T.replies[k]);
    setTimeout(() => setStage('reply'), 1400);
  }
  return (
    <div className="mx-auto max-w-sm text-center">
      {stage === 'write' && (
        <form onSubmit={send}>
          <p className="text-[15px] text-foreground/80">{T.slipAsk}</p>
          <div className="play-note mt-4">
            <textarea value={text} onChange={(e) => setText([...e.target.value].slice(0, MAX).join(''))} placeholder={T.slipPh} rows={3} className="w-full resize-none bg-transparent text-lg leading-relaxed outline-none" />
            <p className="text-right text-xs text-foreground/50">{len(text)}/{MAX}</p>
          </div>
          <button type="submit" disabled={!text.trim()} className="play-btn mt-4">{T.send}</button>
        </form>
      )}
      {stage === 'flying' && (
        <div className="py-6">
          <div className="play-note play-fly mx-auto"><p className="text-lg leading-relaxed">{sent}</p></div>
          <p className="mt-4 text-sm text-foreground/60">{T.flying}</p>
        </div>
      )}
      {stage === 'reply' && (
        <div className="py-2">
          <p className="mb-3 text-sm font-medium" style={{ color: 'var(--ink)' }}>📝 {T.replyFrom}</p>
          <div className="slip-pop flex items-end justify-center gap-2">
            <img src="/reactions/hug.webp" alt="" className="play-bounce h-20 w-20 shrink-0 drop-shadow" />
            <div className="play-note text-left" style={{ transform: 'rotate(-2deg)' }}>
              <p className="text-lg leading-relaxed">{reply}</p>
              <p className="mt-2 text-right text-xs text-foreground/50">— 🦫</p>
            </div>
          </div>
          <button type="button" onClick={() => { setText(''); setStage('write'); }} className="play-btn mt-5">{T.again}</button>
        </div>
      )}
    </div>
  );
}

function LedgerPlay({ T }) {
  const seed = () => T.seed.map(([cat, amount, note], i) => ({ id: i, cat, amount, note }));
  const [items, setItems] = useState(seed);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [cat, setCat] = useState(T.cats[0][0]);
  const [toast, setToast] = useState(false);
  const color = (c) => T.cats.find(([n]) => n === c)?.[1] || '#9CA3AF';
  const total = items.reduce((s, x) => s + x.amount, 0);
  const spent = SPENT_BEFORE + total;
  const byCat = T.cats.map(([n, col]) => [n, col, items.filter((x) => x.cat === n).reduce((s, x) => s + x.amount, 0)]).filter((x) => x[2] > 0);
  function add(e) {
    e.preventDefault();
    const n = Math.round(Number(amount));
    if (!(n > 0)) return;
    setItems((prev) => [{ id: Date.now(), cat, amount: Math.min(n, 999999), note: note.trim() }, ...prev]);
    setAmount('');
    setNote('');
    setToast(true);
    setTimeout(() => setToast(false), 1200);
  }
  const pct = Math.min(100, Math.round((spent / BUDGET) * 100));
  return (
    <div className="mx-auto grid max-w-2xl gap-5 md:grid-cols-2">
      <form onSubmit={add} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {T.cats.map(([n, col]) => (
            <button key={n} type="button" onClick={() => setCat(n)} className="rounded-full border px-3 py-1 text-sm transition-colors" style={cat === n ? { background: col, borderColor: col, color: '#fff' } : { borderColor: 'rgba(51,65,92,.2)', background: 'rgba(255,255,255,.7)' }}>{n}</button>
          ))}
        </div>
        <input type="number" inputMode="numeric" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={T.amountPh} className="play-input text-lg" />
        <input value={note} maxLength={20} onChange={(e) => setNote(e.target.value)} placeholder={T.notePh} className="play-input" />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={!(Number(amount) > 0)} className="play-btn">{T.add}</button>
          {toast && <span className="slip-pop text-sm font-medium" style={{ color: '#5B9A68' }}>✓ {T.saved}</span>}
          <button type="button" onClick={() => setItems([])} className="ml-auto text-xs text-foreground/50 underline">{T.reset}</button>
        </div>
      </form>
      <div className="rounded-2xl border bg-white/70 p-4" style={{ borderColor: 'rgba(51,65,92,.12)' }}>
        <div className="flex items-baseline justify-between text-sm"><span className="font-medium" style={{ color: 'var(--ink)' }}>{T.budget}</span><span className="tabular-nums text-foreground/70">{spent.toLocaleString()} / {BUDGET.toLocaleString()}</span></div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(51,65,92,.1)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct >= 90 ? '#C1666B' : 'var(--ink)' }} />
        </div>
        {byCat.length > 0 && (
          <div className="mt-3 flex h-2 overflow-hidden rounded-full">
            {byCat.map(([n, col, v]) => <div key={n} className="transition-all duration-500" style={{ width: `${(v / total) * 100}%`, background: col }} />)}
          </div>
        )}
        <p className="mt-4 mb-1.5 text-xs text-foreground/60">{T.today}　<span className="tabular-nums">{total.toLocaleString()}</span></p>
        <ul className="max-h-44 space-y-1 overflow-y-auto">
          {items.map((x) => (
            <li key={x.id} className="slip-pop flex items-center gap-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(x.cat) }} />
              <span>{x.cat}</span>
              {x.note && <span className="truncate text-foreground/60">{x.note}</span>}
              <span className="ml-auto tabular-nums">{x.amount.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function LandingPlay({ lang, full }) {
  const T = COPY[lang] || COPY.zh;
  const [tab, setTab] = useState('mood');
  return (
    <section id="play" data-guide="play" className="mx-auto max-w-4xl scroll-mt-16 px-5 py-14 md:px-8 md:py-20">
      <h2 className="landing-serif text-center text-[26px] md:text-[34px]" style={{ color: 'var(--ink)' }}>{T.title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-[1.8] text-foreground/75">{T.text}</p>
      <div className="mx-auto mt-7 grid max-w-2xl grid-cols-2 gap-2 md:grid-cols-4">
        {T.tabs.map(([k, emoji, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${tab === k ? 'shadow-sm' : 'text-foreground/70 hover:bg-white/60'}`} style={tab === k ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : { borderColor: 'rgba(51,65,92,.2)' }}>
            <span className="mr-1">{emoji}</span>{label}
          </button>
        ))}
      </div>
      <div className="landing-card mt-5 min-h-[300px] rounded-3xl p-5 md:p-8">
        {tab === 'mood' && <MoodPlay T={T} />}
        {tab === 'slip' && <SlipPlay key={lang} T={T} />}
        {tab === 'ledger' && <LedgerPlay key={lang} T={T} />}
        {tab === 'book' && (
          <Suspense fallback={<p className="text-center text-sm text-foreground/60">{T.loading}</p>}>
            <PlayBook lang={lang} labels={T.book} />
          </Suspense>
        )}
      </div>
      {!full && (
        <div className="mt-6 text-center">
          <Link to="/register" className="inline-block rounded-lg px-5 py-3 text-[15px] font-medium shadow-sm" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>{T.cta}</Link>
        </div>
      )}
    </section>
  );
}

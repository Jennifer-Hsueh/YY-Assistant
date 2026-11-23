// 月刊書本的每一頁(固定 420×594)
import '@fontsource/cormorant-garamond/latin-600.css';
import './book.css';
import { BOARD, MOOD_LEVEL, beaverWords, coverSrc, monthCells, moodRank, ymLabel } from '../../lib/book';
import { moodEmoji } from '../../lib/moods';

const T = {
  zh: {
    overview: '本月概況', calendar: '行事曆', mood: '心情與時光', notes: '墨箋絮語', posts: '微光拾憶', beaver: '海狸的話',
    income: '收入', expense: '支出', balance: '結餘', top: '支出前五名', ledgers: '帳本', shared: '共同',
    events: '行程', annivs: '紀念日', words: '寫下的話', none: '（未分類）', foreign: '外幣',
    wd: ['日', '一', '二', '三', '四', '五', '六'], most: '這個月最常出現', days: '天',
    noNotes: '這個月沒有寫下絮語', noPosts: '這個月沒有發文', noMood: '這個月還沒有記下心情',
    say: '我想對這個月說', cont: '（續）', more: (n) => `+${n}`,
    y_overview: '年度概況', y_months: '每月一覽', y_mood: '一年的心情', y_photos: '一年的時光', y_messages: '每月一句話',
    y_dates: '紀念日與行程', y_letter: '給自己的話', txCount: '記帳筆數', byCat: '支出分類', others: '其他',
    monthExp: '每月支出', yMost: '花最多', least: '最省', mo: (m) => `${m} 月`, noMoodMonth: '這個月沒有記下心情',
    noPhoto: '—', noMessages: '今年還沒有在月刊寫下一句話', eventsByMonth: '每月行程數', busiest: (m, n) => `行程最多：${m}（${n} 個）`,
    annivList: '今年的紀念日', noAnnivs: '今年沒有紀念日', noExpense: '今年還沒有支出紀錄', yearbook: 'YEARBOOK',
  },
  en: {
    overview: 'This Month', calendar: 'Calendar', mood: 'Moods & Moments', notes: 'Ink Notes', posts: 'Glimmers', beaver: 'From Beaver',
    income: 'Income', expense: 'Expense', balance: 'Balance', top: 'Top 5 spending', ledgers: 'Ledgers', shared: 'Shared',
    events: 'Events', annivs: 'Anniversaries', words: 'Words', none: '(Uncategorized)', foreign: 'Foreign currency',
    wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], most: 'Most frequent', days: 'd',
    noNotes: 'No notes this month', noPosts: 'No posts this month', noMood: 'No moods recorded this month',
    say: 'A note to this month', cont: ' (cont.)', more: (n) => `+${n}`,
    y_overview: 'The Year', y_months: 'Month by Month', y_mood: 'A Year of Moods', y_photos: 'A Year of Moments', y_messages: 'Monthly Notes',
    y_dates: 'Days to Remember', y_letter: 'To Myself', txCount: 'Entries', byCat: 'Spending by category', others: 'Others',
    monthExp: 'Monthly spending', yMost: 'Highest', least: 'Lowest', mo: (m) => new Date(2000, m - 1, 1).toLocaleDateString('en', { month: 'short' }), noMoodMonth: 'No moods this month',
    noPhoto: '—', noMessages: 'No monthly notes this year', eventsByMonth: 'Events per month', busiest: (m, n) => `Busiest: ${m} (${n} events)`,
    annivList: 'Anniversaries this year', noAnnivs: 'No anniversaries this year', noExpense: 'No spending recorded this year', yearbook: 'YEARBOOK',
  },
};
const SUB = { overview: 'THIS MONTH', calendar: 'CALENDAR', mood: 'MOOD', notes: 'NOTES', posts: 'GLIMMERS', beaver: 'FROM BEAVER',
  y_overview: 'THE YEAR', y_months: 'MONTH BY MONTH', y_mood: 'MOODS', y_photos: 'MOMENTS', y_messages: 'MONTHLY NOTES', y_dates: 'DAYS TO REMEMBER', y_letter: 'TO MYSELF' };

const fmt = (n) => Number(n || 0).toLocaleString();
const md = (date) => `${date.slice(5, 7)}/${date.slice(8, 10)}`;

function Head({ kind, tx, cont }) {
  return (
    <>
      <div className="bk-h">{tx[kind]}{cont ? tx.cont : ''}</div>
      <div className="bk-sub">{SUB[kind]}</div>
      <div className="bk-hr" />
    </>
  );
}
const Foot = ({ ym, no }) => <div className="bk-foot"><span>YY手帳 · {ymLabel(ym)}</span><span>{no}</span></div>;

function Overview({ data, tx }) {
  const m = data.money || {};
  const max = Math.max(1, ...(m.top || []).map((x) => x.amount));
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="bk-card"><div className="bk-k">{tx.income}</div><div className="bk-v" style={{ color: 'var(--bk-inc)' }}>{fmt(m.income)}</div></div>
        <div className="bk-card"><div className="bk-k">{tx.expense}</div><div className="bk-v" style={{ color: 'var(--bk-exp)' }}>{fmt(m.expense)}</div></div>
        <div className="bk-card"><div className="bk-k">{tx.balance}</div><div className="bk-v">{fmt((m.income || 0) - (m.expense || 0))}</div></div>
      </div>
      {(m.others || []).map((o) => (
        <div key={o.currency} className="bk-row" style={{ color: 'var(--bk-muted)', fontSize: 10 }}>
          {tx.foreign} {o.currency}：{tx.income} {fmt(o.income)}　{tx.expense} {fmt(o.expense)}
        </div>
      ))}
      {(m.top || []).length > 0 && (
        <>
          <p className="bk-label">{tx.top}</p>
          {m.top.map((x) => (
            <div key={x.name} className="bk-row">
              <span style={{ width: 62, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name || tx.none}</span>
              <div className="bk-bar" style={{ width: Math.max(4, (x.amount / max) * 190), background: x.color || '#9CA3AF' }} />
              <span>{fmt(x.amount)}</span>
            </div>
          ))}
        </>
      )}
      {(m.ledgers || []).length > 0 && (
        <>
          <p className="bk-label">{tx.ledgers}</p>
          {m.ledgers.slice(0, 5).map((l) => (
            <div key={l.name} className="bk-row">
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}{l.shared && <span className="bk-tag">{tx.shared}</span>}</span>
              <span>{tx.expense} {fmt(l.expense)}</span>
            </div>
          ))}
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
        <div className="bk-card"><div className="bk-k">{tx.events}</div><div className="bk-v">{data.counts?.events || 0}</div></div>
        <div className="bk-card"><div className="bk-k">{tx.annivs}</div><div className="bk-v">{data.counts?.annivs || 0}</div></div>
        <div className="bk-card"><div className="bk-k">{tx.words}</div><div className="bk-v">{data.counts?.words || 0}</div></div>
      </div>
    </>
  );
}

function Calendar({ data, tx }) {
  const cells = monthCells(data.ym);
  const rows = cells.length / 7;
  const h = rows > 5 ? 64 : 76;
  return (
    <div className="bk-cal">
      {tx.wd.map((w, i) => <div key={i} className="bk-wd">{w}</div>)}
      {cells.map((c, i) => {
        if (!c) return <div key={i} className="bk-off" style={{ minHeight: h }} />;
        const items = [
          ...(data.annivs || []).filter((a) => a.date === c.date).map((a) => ({ an: true, title: a.title })),
          ...(data.events || []).filter((e) => e.date === c.date),
        ];
        const max = rows > 5 ? 3 : 4;
        const shown = items.length > max ? items.slice(0, max - 1) : items;
        return (
          <div key={i} style={{ minHeight: h, height: h }}>
            <span className="bk-d">{c.day}</span>
            {shown.map((e, j) => (e.an
              ? <span key={j} className="bk-ev bk-an">🎂 {e.title}</span>
              : <span key={j} className="bk-ev"><i style={{ background: e.color || '#9CA3AF' }} />{e.title}</span>))}
            {shown.length < items.length && <span className="bk-ev" style={{ color: 'var(--bk-muted)' }}>{tx.more(items.length - shown.length)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Mood({ data, tx }) {
  const cells = monthCells(data.ym);
  const rank = moodRank(data.moods);
  const h = cells.length / 7 > 5 ? 56 : 64;
  return (
    <>
      <div className="bk-cal">
        {tx.wd.map((w, i) => <div key={i} className="bk-wd">{w}</div>)}
        {cells.map((c, i) => (c
          ? (data.photo_urls?.[c.date]
            ? <div key={i} className="bk-photo" style={{ minHeight: h, height: h }}><img src={data.photo_urls[c.date]} alt="" crossOrigin="anonymous" /><span className="bk-d">{c.day}</span>{data.moods?.[c.date] && <span className="bk-photo-mood">{moodEmoji(data.moods[c.date])}</span>}</div>
            : <div key={i} style={{ minHeight: h }}><span className="bk-d">{c.day}</span><div className="bk-mood">{moodEmoji(data.moods?.[c.date]) || ''}</div></div>)
          : <div key={i} className="bk-off" style={{ minHeight: h }} />))}
      </div>
      {rank.length ? (
        <>
          <p className="bk-label">{tx.most}</p>
          <div style={{ fontSize: 12 }}>{rank.slice(0, 4).map((r) => `${r.emoji} ${r.days} ${tx.days}`).join('　')}</div>
        </>
      ) : <p className="bk-empty" style={{ marginTop: 20 }}>{tx.noMood}</p>}
    </>
  );
}

function Notes({ items, tx }) {
  if (!items.length) return <p className="bk-empty">{tx.noNotes}</p>;
  return items.map((n, i) => <div key={i} className="bk-note"><div className="bk-t">{md(n.date)}</div>{n.content}</div>);
}

function Posts({ items, tx, lang }) {
  if (!items.length) return <p className="bk-empty">{tx.noPosts}</p>;
  return items.map((p, i) => (
    <div key={i} className="bk-post">
      <div className="bk-t">{md(p.date)} {moodEmoji(p.mood) || ''} {(BOARD[lang] || BOARD.en)?.[p.board] ? `· ${(BOARD[lang] || BOARD.en)[p.board]}` : ''}</div>
      {p.title && <p style={{ fontWeight: 600 }}>{p.title}</p>}
      <p>{p.content}</p>
      {p.images?.length > 0 && (
        <div className="bk-photos">{p.images.slice(0, 2).map((im) => <img key={im.key} src={im.url} crossOrigin="anonymous" alt="" />)}</div>
      )}
    </div>
  ));
}

// ---------- 年鑑 ----------
const PALETTE = ['#E07A5F', '#3D7EA6', '#81B29A', '#F2A541', '#C77DBA', '#B08968', '#6D8EA0', '#D4A5A5'];
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// 年度概況:收支三格 + 依分類的大圓餅圖(前 7 名,其餘併成「其他」)
function YearOverview({ data, tx }) {
  const m = data.money || {};
  const cats = m.cats || [];
  const main = cats.slice(0, 7);
  const rest = cats.slice(7).reduce((s, c) => s + c.amount, 0);
  const slices = [...main.map((c, i) => ({ name: c.name || tx.none, amount: c.amount, color: c.color || PALETTE[i % PALETTE.length] })), ...(rest > 0 ? [{ name: tx.others, amount: rest, color: '#C9C4BA' }] : [])];
  const total = slices.reduce((s, c) => s + c.amount, 0);
  const R = 82; const C = 92;
  let a0 = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const a1 = a0 + (s.amount / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = slices.length === 1
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
      : `M ${C} ${C} L ${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)} Z`;
    a0 = a1;
    return { ...s, d };
  });
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="bk-card"><div className="bk-k">{tx.income}</div><div className="bk-v" style={{ color: 'var(--bk-inc)' }}>{fmt(m.income)}</div></div>
        <div className="bk-card"><div className="bk-k">{tx.expense}</div><div className="bk-v" style={{ color: 'var(--bk-exp)' }}>{fmt(m.expense)}</div></div>
        <div className="bk-card"><div className="bk-k">{tx.balance}</div><div className="bk-v">{fmt((m.income || 0) - (m.expense || 0))}</div></div>
      </div>
      <div className="bk-row" style={{ color: 'var(--bk-muted)', fontSize: 10 }}>{tx.txCount} {fmt(m.tx_count)}</div>
      {(m.others || []).map((o) => (
        <div key={o.currency} className="bk-row" style={{ color: 'var(--bk-muted)', fontSize: 10 }}>{tx.foreign} {o.currency}：{tx.income} {fmt(o.income)}　{tx.expense} {fmt(o.expense)}</div>
      ))}
      <p className="bk-label">{tx.byCat}</p>
      {total > 0 ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <svg width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`} style={{ flexShrink: 0 }}>
            {arcs.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke="#FBF8F2" strokeWidth="1.5" />)}
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            {arcs.map((s, i) => (
              <div key={i} className="bk-row" style={{ margin: '4px 0' }}>
                <i style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span>{fmt(s.amount)}</span>
                <span style={{ width: 36, textAlign: 'right', color: 'var(--bk-muted)' }}>{pct(s.amount, total)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="bk-empty" style={{ marginTop: 30 }}>{tx.noExpense}</p>}
    </>
  );
}

// 每月一覽:12 個月支出長條圖,標出花最多與最省的月份
function YearMonths({ data, tx }) {
  const ms = data.money?.months || [];
  const startM = data.since?.startsWith(data.ym) ? Number(data.since.slice(5, 7)) : 1;
  const used = ms.filter((x) => x.m >= startM);
  const max = Math.max(1, ...ms.map((x) => x.expense));
  const withExp = used.filter((x) => x.expense > 0);
  const hi = withExp.length ? withExp.reduce((a, b) => (b.expense > a.expense ? b : a)) : null;
  const lo = withExp.length > 1 ? withExp.reduce((a, b) => (b.expense < a.expense ? b : a)) : null;
  const W = 356; const H = 230; const bw = 20; const step = W / 12;
  return (
    <>
      <p className="bk-label">{tx.monthExp}</p>
      <svg width={W} height={H + 34} viewBox={`0 0 ${W} ${H + 34}`}>
        <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(51,65,92,.35)" />
        {ms.map((x, i) => {
          const h = x.expense ? Math.max(2, (x.expense / max) * (H - 24)) : 0;
          const cx = step * i + step / 2;
          const color = hi && x.m === hi.m ? 'var(--bk-exp)' : lo && x.m === lo.m ? 'var(--bk-inc)' : (x.m < startM ? '#E5E0D6' : '#AFA89A');
          return (
            <g key={x.m}>
              <rect x={cx - bw / 2} y={H - h} width={bw} height={h} rx="3" fill={color} />
              {x.expense > 0 && <text x={cx} y={H - h - 4} fontSize="7" textAnchor="middle" fill="#8A8578">{x.expense >= 10000 ? `${Math.round(x.expense / 1000)}k` : fmt(x.expense)}</text>}
              <text x={cx} y={H + 14} fontSize="9" textAnchor="middle" fill="#8A8578">{x.m}</text>
            </g>
          );
        })}
      </svg>
      {hi && <div className="bk-row"><i style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--bk-exp)' }} />{tx.yMost}：{tx.mo(hi.m)}　{fmt(hi.expense)}</div>}
      {lo && <div className="bk-row"><i style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--bk-inc)' }} />{tx.least}：{tx.mo(lo.m)}　{fmt(lo.expense)}</div>}
    </>
  );
}

// 一年的心情:每個月一張折線圖(橫軸日期、縱軸心情高低),點上畫當天的心情;沒記的日子線斷開
const LEVEL_ICON = { 5: 'sunny', 4: 'flower', 3: 'cloudy', 2: 'rainy', 1: 'storm' };
function MoodLine({ ym, moods, tx }) {
  const [y, mo] = ym.split('-').map(Number);
  const days = new Date(y, mo, 0).getDate();
  const W = 356; const H = 50; const L = 18; const T = 5; const B = 9; const step = (W - L - 6) / (days - 1);
  const lv = (k) => MOOD_LEVEL[k] || null;
  const yOf = (l) => T + ((5 - l) / 4) * (H - T - B);
  const pts = [];
  for (let d = 1; d <= days; d += 1) {
    const date = `${ym}-${String(d).padStart(2, '0')}`;
    const k = moods?.[date];
    pts.push(lv(k) ? { d, x: L + (d - 1) * step, y: yOf(lv(k)), k } : null);
  }
  const segs = [];
  let cur = [];
  pts.forEach((p) => { if (p) cur.push(p); else { if (cur.length > 1) segs.push(cur); cur = []; } });
  if (cur.length > 1) segs.push(cur);
  const any = pts.some(Boolean);
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--bk-ink)', lineHeight: 1.35 }}>{tx.mo(mo)}</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {[5, 4, 3, 2, 1].map((l) => (
          <g key={l}>
            <line x1={L} y1={yOf(l)} x2={W - 4} y2={yOf(l)} stroke="rgba(51,65,92,.08)" />
            <text x="0" y={yOf(l) + 2.5} fontSize="6.5">{moodEmoji(LEVEL_ICON[l])}</text>
          </g>
        ))}
        {[1, 10, 20, days].map((d) => <text key={d} x={L + (d - 1) * step} y={H - 1} fontSize="6.5" textAnchor="middle" fill="#8A8578">{d}</text>)}
        {segs.map((s, i) => <polyline key={i} points={s.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#B08238" strokeWidth="1.2" strokeLinejoin="round" />)}
        {pts.filter(Boolean).map((p) => <text key={p.d} x={p.x} y={p.y + 2.5} fontSize="7.5" textAnchor="middle">{moodEmoji(p.k)}</text>)}
        {!any && <text x={W / 2} y={H / 2} fontSize="9" textAnchor="middle" fill="#8A8578">{tx.noMoodMonth}</text>}
      </svg>
    </div>
  );
}

function YearPhotos({ data, items, tx }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {items.map((ym) => {
        const url = data.photo_urls?.[ym];
        return (
          <div key={ym} style={{ position: 'relative', height: 100, borderRadius: 6, overflow: 'hidden', background: '#fff', border: '1px solid var(--bk-line)' }}>
            {url ? <img src={url} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--bk-muted)', fontSize: 11 }}>{tx.noPhoto}</div>}
            <span style={{ position: 'absolute', left: 5, top: 3, fontSize: 9.5, color: url ? '#fff' : 'var(--bk-muted)', textShadow: url ? '0 1px 2px rgba(0,0,0,.6)' : 'none' }}>{tx.mo(Number(ym.slice(5, 7)))}</span>
          </div>
        );
      })}
    </div>
  );
}

function YearMessages({ items, tx }) {
  if (!items.length) return <p className="bk-empty">{tx.noMessages}</p>;
  return items.map((m) => (
    <div key={m.ym} style={{ marginBottom: 12 }}>
      <div className="bk-t">{tx.mo(Number(m.ym.slice(5, 7)))}</div>
      <div className="bk-quote" style={{ fontSize: 12.5, lineHeight: 1.8 }}>{m.message}</div>
    </div>
  ));
}

function YearDates({ data, tx }) {
  const counts = data.events_by_month || [];
  const max = Math.max(1, ...counts);
  const top = counts.reduce((best, n, i) => (n > best.n ? { m: i + 1, n } : best), { m: 0, n: 0 });
  const annivs = data.annivs || [];
  const shown = annivs.slice(0, 14);
  return (
    <>
      <p className="bk-label" style={{ marginTop: 0 }}>{tx.eventsByMonth}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
        {counts.map((n, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--bk-muted)' }}>{n || ''}</div>
            <div style={{ height: Math.max(n ? 3 : 1, (n / max) * 62), background: top.n && i + 1 === top.m ? 'var(--bk-hl)' : '#C9C4BA', borderRadius: 3 }} />
            <div style={{ fontSize: 8.5, color: 'var(--bk-muted)', marginTop: 2 }}>{i + 1}</div>
          </div>
        ))}
      </div>
      {top.n > 0 && <div className="bk-row" style={{ marginTop: 8 }}>{tx.busiest(tx.mo(top.m), top.n)}</div>}
      <p className="bk-label" style={{ marginTop: 18 }}>{tx.annivList}</p>
      {shown.length ? shown.map((a, i) => (
        <div key={i} className="bk-row" style={{ margin: '3px 0' }}>
          <span style={{ width: 38, color: 'var(--bk-muted)' }}>{md(a.date)}</span><span className="bk-an">🎂</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
        </div>
      )) : <p style={{ fontSize: 11, color: 'var(--bk-muted)' }}>{tx.noAnnivs}</p>}
      {annivs.length > shown.length && <div className="bk-row" style={{ color: 'var(--bk-muted)' }}>{tx.more(annivs.length - shown.length)}</div>}
    </>
  );
}

const YEAR_POEM = {
  zh: ['謝謝你，這一年也和 YY手帳 一起走過。', '', '一年有好多個日子——', '認真記下的每一筆、', '赴過的每一場約、', '晴天、雨天，', '和寫給自己的每一句話，', '都收在這本書裡了。', '', '新的一年，我們也慢慢來。'],
  en: ['Thank you for spending this year with YY.', '', 'So many days in one year —', 'every coin you counted,', 'every plan you kept,', 'the sunny days and the rainy ones,', 'and every word you wrote to yourself,', 'all kept in this book.', '', 'Let’s take the new year slowly, too.'],
};

const POEM = {
  zh: ['謝謝你，這個月也和 YY手帳 一起走過。', '', '這是一本只屬於你的書——', '裡面有你認真花下的每一筆、', '赴過的每一場約，', '晴天和雨天，', '還有寫給自己的每一句話。', '', '願它一個月一個月地慢慢長大，', '成為你珍藏的寶藏之一。'],
  en: ['Thank you for spending this month with YY.', '', 'This book belongs only to you —', 'every coin you spent with care,', 'every plan you kept,', 'the sunny days and the rainy ones,', 'and every word you wrote to yourself.', '', 'May it grow, month by month,', 'into one of your treasures.'],
};

// 一頁書(page 來自 paginate)
export default function BookPage({ book, page, no, lang = 'zh' }) {
  const tx = T[lang] || T.en;
  const { data } = book;
  const cover = book.cover || book.default_cover || 1;
  const isYear = data.kind === 'year';
  if (page.type === 'cover') {
    return (
      <div className="bk-page bk-cover">
        <img src={coverSrc(cover)} alt="" />
        {isYear && <div className="bk-cover-ym" style={{ bottom: 72, fontSize: 11, letterSpacing: '.5em' }}>{tx.yearbook}</div>}
        <div className="bk-cover-ym">{ymLabel(data.ym)}</div>
      </div>
    );
  }
  if (page.type === 'back') {
    return (
      <div className="bk-page bk-back">
        <div className="bk-poem">{(isYear ? YEAR_POEM : POEM)[lang !== 'zh' ? 'en' : 'zh'].map((l, i) => (l ? <div key={i}>{l}</div> : <br key={i} />))}</div>
        <div className="bk-heart">— ♥ —</div>
        <div className="bk-en">Thank you for walking with light.</div>
        <div className="bk-line"><i /><span>YY手帳 · {ymLabel(data.ym)}</span></div>
      </div>
    );
  }
  return (
    <div className="bk-page">
      <Head kind={page.type} tx={tx} cont={page.cont} />
      {page.type === 'overview' && <Overview data={data} tx={tx} />}
      {page.type === 'calendar' && <Calendar data={data} tx={tx} />}
      {page.type === 'mood' && <Mood data={data} tx={tx} />}
      {page.type === 'notes' && <Notes items={page.items} tx={tx} />}
      {page.type === 'posts' && <Posts items={page.items} tx={tx} lang={lang} />}
      {page.type === 'y_overview' && <YearOverview data={data} tx={tx} />}
      {page.type === 'y_months' && <YearMonths data={data} tx={tx} />}
      {page.type === 'y_mood' && page.items.map((ym) => <MoodLine key={ym} ym={ym} moods={data.moods} tx={tx} />)}
      {page.type === 'y_photos' && <YearPhotos data={data} items={page.items} tx={tx} />}
      {page.type === 'y_messages' && <YearMessages items={page.items} tx={tx} />}
      {page.type === 'y_dates' && <YearDates data={data} tx={tx} />}
      {page.type === 'y_letter' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, marginTop: 30 }}>
          <img src="/reactions/hug.webp" alt="" style={{ width: 180, height: 180, objectFit: 'contain' }} />
          {book.message && <div className="bk-quote" style={{ alignSelf: 'stretch' }}>{book.message}</div>}
        </div>
      )}
      {page.type === 'beaver' && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <img src="/reactions/hug.webp" alt="" style={{ width: 92, height: 92, objectFit: 'contain', flexShrink: 0 }} />
            <div className="bk-card" style={{ flex: 1, fontSize: 12, lineHeight: 1.8 }}>{beaverWords(data, lang)}</div>
          </div>
          {book.message && (
            <>
              <p className="bk-label" style={{ marginTop: 26, marginBottom: 8 }}>{tx.say}</p>
              <div className="bk-quote">{book.message}</div>
            </>
          )}
        </>
      )}
      <Foot ym={data.ym} no={no} />
    </div>
  );
}

// 月刊書本的每一頁(固定 420×594)
import '@fontsource/cormorant-garamond/latin-600.css';
import './book.css';
import { BOARD, beaverWords, coverSrc, monthCells, moodRank, ymLabel } from '../../lib/book';
import { moodEmoji } from '../../lib/moods';

const T = {
  zh: {
    overview: '本月概況', calendar: '行事曆', mood: '心情月曆', notes: '墨箋絮語', posts: '微光拾憶', beaver: '海狸的話',
    income: '收入', expense: '支出', balance: '結餘', top: '支出前五名', ledgers: '帳本', shared: '共同',
    events: '行程', annivs: '紀念日', words: '寫下的話', none: '（未分類）', foreign: '外幣',
    wd: ['日', '一', '二', '三', '四', '五', '六'], most: '這個月最常出現', days: '天',
    noNotes: '這個月沒有寫下絮語', noPosts: '這個月沒有發文', noMood: '這個月還沒有記下心情',
    say: '我想對這個月說', cont: '（續）', more: (n) => `+${n}`,
  },
  en: {
    overview: 'This Month', calendar: 'Calendar', mood: 'Mood', notes: 'Ink Notes', posts: 'Glimmers', beaver: 'From Beaver',
    income: 'Income', expense: 'Expense', balance: 'Balance', top: 'Top 5 spending', ledgers: 'Ledgers', shared: 'Shared',
    events: 'Events', annivs: 'Anniversaries', words: 'Words', none: '(Uncategorized)', foreign: 'Foreign currency',
    wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], most: 'Most frequent', days: 'd',
    noNotes: 'No notes this month', noPosts: 'No posts this month', noMood: 'No moods recorded this month',
    say: 'A note to this month', cont: ' (cont.)', more: (n) => `+${n}`,
  },
};
const SUB = { overview: 'THIS MONTH', calendar: 'CALENDAR', mood: 'MOOD', notes: 'NOTES', posts: 'GLIMMERS', beaver: 'FROM BEAVER' };

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
          ? <div key={i} style={{ minHeight: h }}><span className="bk-d">{c.day}</span><div className="bk-mood">{moodEmoji(data.moods?.[c.date]) || ''}</div></div>
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
      <div className="bk-t">{md(p.date)} {moodEmoji(p.mood) || ''} {BOARD[lang]?.[p.board] ? `· ${BOARD[lang][p.board]}` : ''}</div>
      {p.title && <p style={{ fontWeight: 600 }}>{p.title}</p>}
      <p>{p.content}</p>
      {p.images?.length > 0 && (
        <div className="bk-photos">{p.images.slice(0, 2).map((im) => <img key={im.key} src={im.url} crossOrigin="anonymous" alt="" />)}</div>
      )}
    </div>
  ));
}

const POEM = {
  zh: ['謝謝你，這個月也和 YY手帳 一起走過。', '', '這是一本只屬於你的書——', '裡面有你認真花下的每一筆、', '赴過的每一場約，', '晴天和雨天，', '還有寫給自己的每一句話。', '', '願它一個月一個月地慢慢長大，', '成為你珍藏的寶藏之一。'],
  en: ['Thank you for spending this month with YY.', '', 'This book belongs only to you —', 'every coin you spent with care,', 'every plan you kept,', 'the sunny days and the rainy ones,', 'and every word you wrote to yourself.', '', 'May it grow, month by month,', 'into one of your treasures.'],
};

// 一頁書(page 來自 paginate)
export default function BookPage({ book, page, no, lang = 'zh' }) {
  const tx = T[lang] || T.zh;
  const { data } = book;
  const cover = book.cover || book.default_cover || 1;
  if (page.type === 'cover') {
    return (
      <div className="bk-page bk-cover">
        <img src={coverSrc(cover)} alt="" />
        <div className="bk-cover-ym">{ymLabel(data.ym)}</div>
      </div>
    );
  }
  if (page.type === 'back') {
    return (
      <div className="bk-page bk-back">
        <div className="bk-poem">{POEM[lang === 'en' ? 'en' : 'zh'].map((l, i) => (l ? <div key={i}>{l}</div> : <br key={i} />))}</div>
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

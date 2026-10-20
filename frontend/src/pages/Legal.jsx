import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { TERMS, PRIVACY, UPDATED } from '../content/legal';
import { hidePricing } from '../lib/platform';

const DOCS = { terms: TERMS, privacy: PRIVACY };
const show = (b) => !(hidePricing && b?.noIOS);

function Block({ b }) {
  if (b.part) return <h2 className="pt-4 text-base font-semibold">{b.part}</h2>;
  if (b.h) return <h3 className="pt-2 text-sm font-semibold">{b.h}</h3>;
  if (b.p) return <p>{b.p}</p>;
  if (b.ol || b.ul) {
    const items = (b.ol || b.ul).filter(show).map((i) => (typeof i === 'string' ? i : i.text));
    const Tag = b.ol ? 'ol' : 'ul';
    return <Tag className={`space-y-1 pl-5 ${b.ol ? 'list-decimal' : 'list-disc'}`}>{items.map((i) => <li key={i}>{i}</li>)}</Tag>;
  }
  if (b.table) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead><tr>{b.table.head.map((h) => <th key={h} className="whitespace-nowrap border border-border bg-muted/50 px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>{b.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`border border-border px-2 py-1.5 align-top ${i === 0 ? 'whitespace-nowrap' : ''}`}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return null;
}

// 只有內容(註冊頁、同意視窗裡用)
export function LegalContent({ doc }) {
  const d = DOCS[doc];
  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <h1 className="text-lg font-semibold">{d.title}</h1>
      <p className="text-xs text-muted-foreground">最後更新：{UPDATED.replace(/-/g, '/')}</p>
      {d.blocks.filter(show).map((b, i) => <Block key={i} b={b} />)}
    </article>
  );
}

// 疊在畫面上的條款視窗(看完按關閉回到原本畫面,填到一半的資料不會不見)
export function LegalOverlay({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-card" style={{ paddingTop: 'var(--sat, 0px)' }}>
      <div className="flex items-center justify-end border-b border-border px-4 py-2">
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground">關閉</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl"><LegalContent doc={doc} /></div>
      </div>
    </div>
  );
}

export default function Legal({ doc }) {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [doc]);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  return (
    <div className="min-h-screen bg-secondary px-4 pb-10" style={{ paddingTop: 'calc(var(--sat, 0px) + 16px)' }}>
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={back} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />返回
        </button>
        <div className="rounded-xl border border-border bg-card p-5"><LegalContent doc={doc} /></div>
      </div>
    </div>
  );
}

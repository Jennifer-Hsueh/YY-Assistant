// 月刊書櫃:每月一本書,放在書櫃上;點書打開閱讀,草稿可以挑封面、寫一句話、按完成;定稿後可下載 PDF
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '@fontsource/eb-garamond/latin-700.css';
import { LibraryBig, ChevronLeft, ChevronRight, X, Download, Loader2, PencilLine } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { SHELVES, layoutBooks } from '../lib/bookshelf';
import { COVERS, MESSAGE_MAX, coverSrc, paginate, spineColor, ymLabel } from '../lib/book';
import { isNative } from '../lib/platform';
import BookPage from '../components/book/BookPages';
import { Button } from '../components/ui/button';

const TEXT = {
  zh: {
    title: '月刊書櫃', empty: '每個月 1 號，小河狸會把上個月整理成一本書放上書櫃。',
    draftNote: (m, d) => `${m} 月的書還是草稿，${d} 以前可以挑封面、寫一句話。`, open: '打開',
    draft: '草稿', final: '已定稿', until: (d) => `${d} 以前可以修改，之後自動定稿`,
    edit: '挑封面・寫一句話', cover: '封面', say: '我想對這個月說（選填）', save: '儲存', saving: '儲存中…',
    finish: '完成', finishAsk: '完成後就不能再修改了，確定嗎？', finishYes: '確定完成', cancel: '取消',
    pdf: '下載 PDF', making: '製作中…', pdfDraft: '完成後可以下載 PDF', pdfApp: 'PDF 請在網頁版下載',
    loadFail: '讀取失敗，請稍後再試', shelf: '書櫃', year: (y) => `${y} 年`, page: (a, b) => `${a} / ${b}`,
    bookTitle: (ym) => `${ym.slice(0, 4)} 年 ${Number(ym.slice(5, 7))} 月`,
  },
  en: {
    title: 'Monthly Bookshelf', empty: 'On the 1st of each month, Beaver turns last month into a book and puts it here.',
    draftNote: (m, d) => `Your ${m} book is still a draft. Pick a cover and add a note before ${d}.`, open: 'Open',
    draft: 'Draft', final: 'Final', until: (d) => `Editable until ${d}, then it’s finalized`,
    edit: 'Cover & note', cover: 'Cover', say: 'A note to this month (optional)', save: 'Save', saving: 'Saving…',
    finish: 'Finish', finishAsk: 'You can’t edit it after finishing. Continue?', finishYes: 'Finish', cancel: 'Cancel',
    pdf: 'Download PDF', making: 'Making…', pdfDraft: 'PDF is available after finishing', pdfApp: 'Please download the PDF on the web',
    loadFail: 'Couldn’t load. Please try again later.', shelf: 'Shelf', year: (y) => y, page: (a, b) => `${a} / ${b}`,
    bookTitle: (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en', { year: 'numeric', month: 'long' }),
  },
};
const MONTH_EN = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en', { month: 'long' });
const deadlineLabel = (iso, lang) => {
  // 期限是 8 號 0 點,顯示成 7 號
  const d = new Date(new Date(iso).getTime() - 60000);
  return lang === 'en' ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : `${d.getMonth() + 1}/${d.getDate()}`;
};

const readShelf = () => { try { return Number(localStorage.getItem('yy_shelf')) || 2; } catch { return 2; } };

export default function Bookshelf() {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'zh';
  const T = TEXT[lang];
  const [books, setBooks] = useState(null);
  const [error, setError] = useState('');
  const [shelfId, setShelfId] = useState(readShelf);
  const [year, setYear] = useState(null);
  const [openYm, setOpenYm] = useState(null);
  const boxRef = useRef(null);
  const [boxW, setBoxW] = useState(0);

  const load = useCallback(() => api.listBooks().then(({ books }) => { setBooks(books); setError(''); }).catch(() => setError(T.loadFail)), [T.loadFail]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [books]);

  const years = useMemo(() => [...new Set((books || []).map((b) => b.ym.slice(0, 4)))].sort(), [books]);
  const shownYear = year && years.includes(year) ? year : years[years.length - 1];
  const yearBooks = (books || []).filter((b) => b.ym.slice(0, 4) === shownYear);
  const shelf = SHELVES.find((s) => s.id === shelfId) || SHELVES[0];
  const spots = layoutBooks(shelf, yearBooks.length);
  const k = boxW / 1024;
  const draft = (books || []).find((b) => b.status === 'draft');

  const pickShelf = (id) => { setShelfId(id); try { localStorage.setItem('yy_shelf', String(id)); } catch { /* 無痕模式 */ } };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-3xl md:px-8 md:py-10">
      <div className="page-title-row mb-3 flex items-center justify-between gap-2">
        <h1 className="page-title flex items-center gap-2 text-lg font-semibold">
          <LibraryBig className="h-5 w-5 md:hidden" />
          {T.title}
        </h1>
        <div className="flex gap-1.5" aria-label={T.shelf}>
          {SHELVES.map((s) => (
            <button key={s.id} type="button" onClick={() => pickShelf(s.id)}
              className={`h-9 w-9 overflow-hidden rounded-md border-2 bg-card ${s.id === shelfId ? 'border-[var(--ink)]' : 'border-transparent opacity-70'}`}>
              <img src={s.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {years.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button key={y} type="button" onClick={() => setYear(y)}
              className={`rounded-full px-3 py-1 text-sm ${y === shownYear ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{T.year(y)}</button>
          ))}
        </div>
      )}

      {draft && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
          <PencilLine className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">{T.draftNote(lang === 'en' ? MONTH_EN(draft.ym) : Number(draft.ym.slice(5, 7)), deadlineLabel(draft.deadline, lang))}</span>
          <Button size="sm" variant="outline" onClick={() => setOpenYm(draft.ym)}>{T.open}</Button>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div ref={boxRef} className="relative mx-auto aspect-square w-full max-w-[640px] overflow-hidden rounded-xl">
        <img src={shelf.src} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
        {boxW > 0 && spots.map((s, i) => {
          const b = yearBooks[i];
          return (
            <button key={b.ym} type="button" onClick={() => setOpenYm(b.ym)} title={T.bookTitle(b.ym)}
              className={`bk-spine ${b.status === 'draft' ? 'bk-draft' : ''}`}
              style={{ left: s.x * k, top: s.y * k, width: s.w * k, height: s.h * k, background: spineColor(b.cover || ((Number(b.ym.slice(5, 7)) - 1) % 3) + 1) }}>
              <span style={{ fontSize: Math.max(6, s.w * k * 0.62) }}>{ymLabel(b.ym)}</span>
            </button>
          );
        })}
      </div>
      {books && books.length === 0 && <p className="mt-4 text-center text-sm text-muted-foreground">{T.empty}</p>}

      {/* 手機版書背很小:下面再列一排月份,方便點 */}
      {yearBooks.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 md:hidden">
          {yearBooks.map((b) => (
            <button key={b.ym} type="button" onClick={() => setOpenYm(b.ym)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs" style={{ borderColor: spineColor(b.cover || ((Number(b.ym.slice(5, 7)) - 1) % 3) + 1) }}>
              {ymLabel(b.ym)}{b.status === 'draft' ? ` · ${T.draft}` : ''}
            </button>
          ))}
        </div>
      )}

      {openYm && createPortal(<BookViewer ym={openYm} lang={lang} T={T} onClose={() => setOpenYm(null)} onChanged={load} />, document.body)}
    </div>
  );
}

function BookViewer({ ym, lang, T, onClose, onChanged }) {
  const [book, setBook] = useState(null);
  const [err, setErr] = useState('');
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const exportRef = useRef(null);
  const touch = useRef(null);

  const load = useCallback(() => api.getBook(ym).then(({ book }) => setBook(book)).catch(() => setErr(T.loadFail)), [ym, T.loadFail]);
  useEffect(() => { load(); }, [load]);
  const pages = useMemo(() => (book ? paginate(book.data) : []), [book]);
  const last = pages.length - 1;
  const go = useCallback((d) => setIdx((i) => Math.min(Math.max(0, i + d), Math.max(0, last))), [last]);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [go, onClose]);

  // 下載 PDF:把每一頁拍成圖片放進 A5 的 PDF
  useEffect(() => {
    if (!exporting || !book) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
        await document.fonts?.ready;
        const nodes = [...exportRef.current.children];
        await Promise.all(nodes.flatMap((n) => [...n.querySelectorAll('img')]).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5', compress: true });
        for (let i = 0; i < nodes.length; i += 1) {
          if (cancelled) return;
          const canvas = await toCanvas(nodes[i], { pixelRatio: 2.5, width: 420, height: 594 });
          if (i > 0) pdf.addPage('a5', 'portrait');
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 148, 210);
        }
        pdf.save(`YY手帳-${ym}.pdf`);
      } catch (e) {
        console.error('[book pdf]', e);
        setErr(T.loadFail);
      } finally {
        if (!cancelled) setExporting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exporting, book, ym, T.loadFail]);

  const availW = Math.min(vp.w - 24, 760);
  const availH = vp.h - 128;
  const scale = Math.max(0.3, Math.min(availW / 420, availH / 594));
  const isDraft = book?.status === 'draft';
  const page = pages[Math.min(idx, last)];
  const no = idx; // 封面不算頁碼

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85 text-white" style={{ paddingTop: 'var(--sat, 0px)' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{T.bookTitle(ym)}</p>
          {book && <p className="truncate text-[11px] opacity-75">{isDraft ? `${T.draft}・${T.until(deadlineLabel(book.deadline, lang))}` : T.final}</p>}
        </div>
        {isDraft && (
          <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1.5 text-xs">
            <PencilLine className="h-3.5 w-3.5" />{T.edit}
          </button>
        )}
        {book && !isDraft && (
          <button type="button" disabled={exporting || isNative} title={isNative ? T.pdfApp : ''} onClick={() => setExporting(true)}
            className="flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1.5 text-xs disabled:opacity-60">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? T.making : T.pdf}
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="close" className="rounded-md p-1.5 hover:bg-white/15"><X className="h-5 w-5" /></button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}
      >
        {!book ? (
          err ? <p className="text-sm">{err}</p> : <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <div style={{ width: 420 * scale, height: 594 * scale }} className="shadow-2xl">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 420, height: 594 }}>
              <BookPage book={book} page={page} no={no} lang={lang} />
            </div>
          </div>
        )}
      </div>

      {book && (
        <div className="flex items-center justify-center gap-4 px-3 pb-4 pt-2" style={{ paddingBottom: 'calc(1rem + var(--sab, 0px))' }}>
          <button type="button" disabled={idx === 0} onClick={() => go(-1)} className="rounded-full bg-white/15 p-2 disabled:opacity-30" aria-label="prev"><ChevronLeft className="h-5 w-5" /></button>
          <span className="min-w-[4rem] text-center text-sm tabular-nums">{T.page(idx + 1, pages.length)}</span>
          <button type="button" disabled={idx >= last} onClick={() => go(1)} className="rounded-full bg-white/15 p-2 disabled:opacity-30" aria-label="next"><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}
      {book && isDraft && <p className="-mt-2 pb-3 text-center text-[11px] opacity-70">{T.pdfDraft}</p>}
      {book && !isDraft && isNative && <p className="-mt-2 pb-3 text-center text-[11px] opacity-70">{T.pdfApp}</p>}

      {editing && book && (
        <DraftEditor book={book} T={T} onClose={() => setEditing(false)}
          onSaved={(b) => { setBook((cur) => ({ ...cur, ...b })); onChanged(); }}
          onFinished={() => { setEditing(false); load(); onChanged(); }} />
      )}

      {/* PDF 用:畫面外完整排出每一頁 */}
      {exporting && book && (
        <div ref={exportRef} style={{ position: 'fixed', left: -10000, top: 0, width: 420 }} aria-hidden>
          {pages.map((p, i) => <BookPage key={i} book={book} page={p} no={i} lang={lang} />)}
        </div>
      )}
    </div>
  );
}

function DraftEditor({ book, T, onClose, onSaved, onFinished }) {
  const [cover, setCover] = useState(book.cover || book.default_cover || 1);
  const [message, setMessage] = useState(book.message || '');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState('');

  async function save(andFinish) {
    setBusy(true);
    setErr('');
    try {
      const { book: saved } = await api.updateBook(book.ym, { cover, message });
      onSaved(saved);
      if (andFinish) {
        await api.finalizeBook(book.ym);
        onFinished();
      } else {
        onClose();
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-card p-4 text-foreground shadow-xl md:rounded-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + var(--sab, 0px))' }}>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">{T.cover}</p>
          <div className="flex gap-2">
            {COVERS.map((c) => (
              <button key={c.id} type="button" onClick={() => setCover(c.id)}
                className={`w-1/3 overflow-hidden rounded-md border-2 ${cover === c.id ? 'border-[var(--ink)]' : 'border-transparent opacity-70'}`}>
                <img src={coverSrc(c.id, true)} alt="" className="aspect-[1/1.414] w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>{T.say}</span><span>{[...message].length}/{MESSAGE_MAX}</span></p>
          <textarea rows={3} value={message} onChange={(e) => setMessage([...e.target.value].slice(0, MESSAGE_MAX).join(''))}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        {ask ? (
          <div className="space-y-2 rounded-md border border-border p-2">
            <p className="text-sm">{T.finishAsk}</p>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={() => save(true)}>{busy ? T.saving : T.finishYes}</Button>
              <Button variant="outline" className="flex-1" onClick={() => setAsk(false)}>{T.cancel}</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => save(false)}>{busy ? T.saving : T.save}</Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setAsk(true)}>{T.finish}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

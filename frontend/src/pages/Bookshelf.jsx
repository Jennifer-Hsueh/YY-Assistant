// 月刊書櫃:每月一本書(書背依月份固定),從小書櫃開始放、放滿自動換大的;點書打開閱讀,草稿可以寫一句話、按完成;定稿後可下載 PDF
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LibraryBig, ChevronLeft, ChevronRight, X, Download, Loader2, PencilLine } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { fillShelves, layoutBooks } from '../lib/bookshelf';
import { MESSAGE_MAX, YEAR_MESSAGE_MAX, isYearKey, paginateAny, spineColor, viewsOf, ymLabel } from '../lib/book';
import { isNative } from '../lib/platform';
import BookPage from '../components/book/BookPages';
import Spine from '../components/book/Spine';
import { Button } from '../components/ui/button';

const TEXT = {
  zh: {
    title: '月刊書櫃', empty: '每個月 1 號，小河狸會把上個月整理成一本書放上書櫃。',
    draftNote: (m, d) => `${m} 月的書還是草稿，${d} 以前可以寫一句話。`, open: '打開',
    draft: '草稿', final: '已定稿', until: (d) => `${d} 以前可以修改，之後自動定稿`,
    edit: '寫一句話', say: '我想對這個月說（選填）', save: '儲存', saving: '儲存中…',
    finish: '完成', finishAsk: '完成後就不能再修改了，確定嗎？', finishYes: '確定完成', cancel: '取消',
    pdf: '下載 PDF', making: '製作中…', pdfDraft: '完成後可以下載 PDF', pdfApp: 'PDF 請在網頁版下載',
    loadFail: '讀取失敗，請稍後再試', page: (a, b) => `${a} / ${b}`,
    bookTitle: (ym) => (isYearKey(ym) ? `${ym} 年鑑` : `${ym.slice(0, 4)} 年 ${Number(ym.slice(5, 7))} 月`),
    yearDraftNote: (y, d) => `${y} 年鑑還是草稿，${d} 以前可以寫給自己的話。`, sayYear: '給自己的話（選填）',
  },
  en: {
    title: 'Monthly Bookshelf', empty: 'On the 1st of each month, Beaver turns last month into a book and puts it here.',
    draftNote: (m, d) => `Your ${m} book is still a draft. Add a note before ${d}.`, open: 'Open',
    draft: 'Draft', final: 'Final', until: (d) => `Editable until ${d}, then it’s finalized`,
    edit: 'Add a note', say: 'A note to this month (optional)', save: 'Save', saving: 'Saving…',
    finish: 'Finish', finishAsk: 'You can’t edit it after finishing. Continue?', finishYes: 'Finish', cancel: 'Cancel',
    pdf: 'Download PDF', making: 'Making…', pdfDraft: 'PDF is available after finishing', pdfApp: 'Please download the PDF on the web',
    loadFail: 'Couldn’t load. Please try again later.', page: (a, b) => `${a} / ${b}`,
    bookTitle: (ym) => (isYearKey(ym) ? `${ym} Yearbook` : new Date(`${ym}-01T00:00:00`).toLocaleDateString('en', { year: 'numeric', month: 'long' })),
    yearDraftNote: (y, d) => `Your ${y} yearbook is still a draft. Write to yourself before ${d}.`, sayYear: 'A note to myself (optional)',
  },
};
const MONTH_EN = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en', { month: 'long' });
const deadlineLabel = (iso, lang) => {
  // 期限是 8 號 0 點,顯示成 7 號
  const d = new Date(new Date(iso).getTime() - 60000);
  return lang !== 'zh' ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : `${d.getMonth() + 1}/${d.getDate()}`;
};

const SHELF_TEXT = {
  zh: { tab: (i) => `書櫃 ${i}`, count: (a) => `已放 ${a} 本`, note: '放滿了會換一個更大的書櫃', full: '放滿了，下一本會放到更大的書櫃' },
  en: { tab: (i) => `Shelf ${i}`, count: (a) => `${a} books`, note: 'When it’s full, Beaver brings a bigger shelf', full: 'Full! The next book goes on a bigger shelf' },
};

export default function Bookshelf() {
  const { language } = useLanguage();
  const lang = language !== 'zh' ? 'en' : 'zh';
  const T = TEXT[lang];
  const P = SHELF_TEXT[lang];
  const [books, setBooks] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(null); // 第幾個書櫃(0 起),null = 最新的
  const [openYm, setOpenYm] = useState(null);
  const boxRef = useRef(null);
  const [boxW, setBoxW] = useState(0);

  const load = useCallback(() => api.listBooks().then(({ books }) => {
    setBooks(books); setError('');
  }).catch(() => setError(T.loadFail)), [T.loadFail]);
  useEffect(() => { load(); }, [load]);

  // 書依月份順序放:從最小的書櫃開始,放滿了自動換下一個比較大的
  const groups = useMemo(() => fillShelves(books || [], (b) => isYearKey(b.ym)), [books]);
  const shown = page !== null && groups[page] ? page : groups.length - 1;
  const group = groups[shown];
  const shelf = group.shelf;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [books, shown]);

  const k = boxW / shelf.W;
  // 再放一本一般的書也放不下 = 這個書櫃滿了(年鑑佔 2 個位置)
  const isFull = layoutBooks(shelf, [...group.books.map((b) => isYearKey(b.ym)), false]).length <= group.books.length;
  const drafts = (books || []).filter((b) => b.status === 'draft');

  const chips = (list) => (
    <div className="flex flex-wrap justify-center gap-1.5">
      {list.map((b) => (
        <button key={b.ym} type="button" onClick={() => setOpenYm(b.ym)}
          className="rounded-full border bg-card px-2.5 py-1 text-xs" style={{ borderColor: spineColor(b.ym) }}>
          {ymLabel(b.ym)}{b.status === 'draft' ? ` · ${T.draft}` : ''}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-3xl md:px-8 md:py-10">
      <Link to="/room" className="mb-2 inline-block text-xs text-muted-foreground underline">← {lang !== 'zh' ? "Beaver's home" : '小河狸的家'}</Link>
      <div className="page-title-row mb-3 flex items-center justify-between gap-2">
        <h1 className="page-title flex items-center gap-2 text-lg font-semibold">
          <LibraryBig className="h-5 w-5 md:hidden" />
          {T.title}
        </h1>
      </div>

      {groups.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {groups.map((g, i) => (
            <button key={i} type="button" onClick={() => setPage(i)}
              className={`rounded-full px-3 py-1 text-sm ${i === shown ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{P.tab(i + 1)}</button>
          ))}
        </div>
      )}

      {drafts.map((draft) => (
        <div key={draft.ym} className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
          <PencilLine className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">{isYearKey(draft.ym)
            ? T.yearDraftNote(draft.ym, deadlineLabel(draft.deadline, lang))
            : T.draftNote(lang !== 'zh' ? MONTH_EN(draft.ym) : Number(draft.ym.slice(5, 7)), deadlineLabel(draft.deadline, lang))}</span>
          <Button size="sm" variant="outline" onClick={() => setOpenYm(draft.ym)}>{T.open}</Button>
        </div>
      ))}

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {books && (
        <>
          <div ref={boxRef} className="relative mx-auto w-full" style={{ maxWidth: Math.round(shelf.W * 1.45), aspectRatio: `${shelf.W} / ${shelf.H}` }}>
            <img src={shelf.src} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
            {boxW > 0 && group.spots.map((s, i) => {
              const b = group.books[i];
              return (
                <button key={b.ym} type="button" onClick={() => setOpenYm(b.ym)} title={T.bookTitle(b.ym)} aria-label={T.bookTitle(b.ym)}
                  className={`bk-spine ${b.status === 'draft' ? 'bk-draft' : ''}`}
                  style={{ left: s.x * k, top: s.y * k, width: s.w * k, height: s.h * k }}>
                  <Spine ym={b.ym} w={s.w * k} h={s.h * k} small />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">{P.count(group.books.length)}・{isFull ? P.full : P.note}</p>
          {books.length === 0 && <p className="mt-2 text-center text-sm text-muted-foreground">{T.empty}</p>}
          {/* 書背很窄:下面再列一排月份,方便點 */}
          {group.books.length > 0 && <div className="mt-3">{chips(group.books)}</div>}
        </>
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
  const pages = useMemo(() => (book ? paginateAny(book.data) : []), [book]);
  // 一個畫面:一頁,或左右對開兩頁(年鑑的「一年的心情」)
  const views = useMemo(() => viewsOf(pages), [pages]);
  const last = views.length - 1;
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

  const isDraft = book?.status === 'draft';
  const view = views[Math.min(idx, Math.max(0, last))] || [0];
  const pageW = 420 * view.length;
  const availW = Math.min(vp.w - 24, view.length > 1 ? 1200 : 760);
  const availH = vp.h - 128;
  const scale = Math.max(0.2, Math.min(availW / pageW, availH / 594));
  const pageLabel = view.length > 1 ? `${view[0] + 1}–${view[1] + 1}` : `${view[0] + 1}`;

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
          <div style={{ width: pageW * scale, height: 594 * scale }} className="shadow-2xl">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: pageW, height: 594, display: 'flex' }}>
              {/* 封面不算頁碼:頁碼 = 第幾頁(從 0 起) */}
              {view.map((pi, j) => (
                <div key={pi} style={{ width: 420, height: 594, position: 'relative' }}>
                  <BookPage book={book} page={pages[pi]} no={pi} lang={lang} />
                  {/* 對開時中間的書溝陰影 */}
                  {view.length > 1 && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 26, pointerEvents: 'none', [j === 0 ? 'right' : 'left']: 0, background: `linear-gradient(${j === 0 ? 'to left' : 'to right'}, rgba(0,0,0,.16), rgba(0,0,0,0))` }} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {book && (
        <div className="flex items-center justify-center gap-4 px-3 pb-4 pt-2" style={{ paddingBottom: 'calc(1rem + var(--sab, 0px))' }}>
          <button type="button" disabled={idx === 0} onClick={() => go(-1)} className="rounded-full bg-white/15 p-2 disabled:opacity-30" aria-label="prev"><ChevronLeft className="h-5 w-5" /></button>
          <span className="min-w-[4rem] text-center text-sm tabular-nums">{T.page(pageLabel, pages.length)}</span>
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
  const [message, setMessage] = useState(book.message || '');
  const yearBook = isYearKey(book.ym);
  const max = yearBook ? YEAR_MESSAGE_MAX : MESSAGE_MAX;
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState('');

  async function save(andFinish) {
    setBusy(true);
    setErr('');
    try {
      const { book: saved } = await api.updateBook(book.ym, { message });
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
          <p className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>{yearBook ? T.sayYear : T.say}</span><span>{[...message].length}/{max}</span></p>
          <textarea rows={yearBook ? 5 : 3} value={message} onChange={(e) => setMessage([...e.target.value].slice(0, max).join(''))}
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

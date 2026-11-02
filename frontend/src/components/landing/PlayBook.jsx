import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import BookPage from '../book/BookPages';
import { paginate } from '../../lib/book';
import { sampleBook } from '../../lib/sampleBook';

// 試玩區:翻一本範例月刊(假資料)
export default function PlayBook({ lang, labels }) {
  const book = useMemo(() => sampleBook(lang), [lang]);
  const pages = useMemo(() => paginate(book.data), [book]);
  const [i, setI] = useState(0);
  const [w, setW] = useState(300);
  useEffect(() => {
    const fit = () => setW(Math.min(340, window.innerWidth - 84));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const scale = w / 420;
  const go = (n) => setI(Math.max(0, Math.min(pages.length - 1, n)));
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2">
        <button type="button" aria-label={labels.prev} onClick={() => go(i - 1)} disabled={i === 0} className="hidden rounded-full p-2 hover:bg-black/5 disabled:opacity-25 md:block"><ChevronLeft className="h-6 w-6" /></button>
        <button type="button" onClick={() => go(i + 1 < pages.length ? i + 1 : 0)} className="play-book shadow-xl" style={{ width: w, height: 594 * scale }} aria-label={labels.next}>
          <div key={i} className="play-page" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 420, height: 594, textAlign: 'left' }}>
            <BookPage book={book} page={pages[i]} no={i} lang={lang} />
          </div>
        </button>
        <button type="button" aria-label={labels.next} onClick={() => go(i + 1)} disabled={i === pages.length - 1} className="hidden rounded-full p-2 hover:bg-black/5 disabled:opacity-25 md:block"><ChevronRight className="h-6 w-6" /></button>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {pages.map((_, k) => (
          <button key={k} type="button" aria-label={`${k + 1}`} onClick={() => setI(k)} className="h-2 w-2 rounded-full" style={{ background: k === i ? 'var(--ink)' : 'rgba(51,65,92,.2)' }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-foreground/60">{labels.hint}</p>
    </div>
  );
}

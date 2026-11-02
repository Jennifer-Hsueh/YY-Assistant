import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// 介紹頁的導覽小河狸:固定在左下角,捲到哪一段就介紹哪一段(看 data-guide)
const LINES = {
  zh: {
    hero: ['cheer', '嗨！我是小河狸 🦫 往下滑，我帶你逛逛 YY手帳～'],
    overview: ['approve', '記帳、行程、紀念日、記事……一本手帳全部裝得下喔！'],
    play: ['laugh', '來玩玩看！選個心情、寫張紙條給我，我會回你喔～'],
    ledger: ['approve', '日常的帳自己記，旅遊、家用就開一本共同帳本，誰付多少一清二楚。'],
    calendar: ['cheer', '和家人共用一本行事曆，生日和紀念日我也會提前提醒你！'],
    home: ['hug', '每天打開首頁，選個心情、看看今天的行程，還有朋友傳來的小紙條。'],
    community: ['understand', '開心或難過都可以來這裡說，大家會溫柔地接住你。'],
    bookshelf: ['hug', '每個月初，我會把你上個月的日子整理成一本書，放上書櫃～'],
    themes: ['laugh', '心情不一樣的時候，換一種風格的手帳吧！'],
    plans: ['approve', '前三個月全部免費，不用信用卡，放心試試看！'],
    end: ['cheer', '準備好了嗎？我們一起把日子好好收起來吧！'],
  },
  en: {
    hero: ['cheer', "Hi! I'm Beaver 🦫 Scroll down and I'll show you around YY!"],
    overview: ['approve', 'Money, plans, anniversaries, notes: all in one notebook!'],
    play: ['laugh', 'Try it out! Pick a mood or write me a note, and I will write back~'],
    ledger: ['approve', 'Keep your own ledger, and share one for trips or the household.'],
    calendar: ['cheer', 'Share a calendar with family. I will remind you of birthdays, too!'],
    home: ['hug', 'Open Home to pick a mood, see today, and read notes from friends.'],
    community: ['understand', 'Happy or sad, you can share it here. Everyone is gentle.'],
    bookshelf: ['hug', 'At the start of each month, I turn last month into a book for your shelf~'],
    themes: ['laugh', 'Feeling different today? Try another notebook style!'],
    plans: ['approve', 'Free for three months, no credit card. Give it a try!'],
    end: ['cheer', 'Ready? Let’s start keeping your days together!'],
  },
};

export default function BeaverGuide({ lang }) {
  const [key, setKey] = useState('hero');
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const els = [...document.querySelectorAll('[data-guide]')];
    if (!els.length || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (seen) { setKey(seen.target.dataset.guide); setOpen(true); }
    }, { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.25, 0.5] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);
  const [img, text] = (LINES[lang] || LINES.zh)[key] || LINES.zh.hero;
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-40 flex items-end gap-1.5 md:bottom-6 md:left-6">
      <button type="button" onClick={() => setOpen((v) => !v)} className="pointer-events-auto shrink-0" aria-label="🦫">
        <img key={img} src={`/reactions/${img}.webp`} alt="" width="160" height="160" className="guide-beaver h-16 w-16 drop-shadow-md md:h-20 md:w-20" />
      </button>
      {open && (
        <div key={key} className="guide-bubble pointer-events-auto relative mb-7 max-w-[calc(100vw-110px)] rounded-2xl border bg-white py-2 pl-3 pr-7 text-[14px] leading-snug shadow-lg md:mb-9 md:max-w-xs md:text-[15px]" style={{ borderColor: 'rgba(51,65,92,.15)', color: 'var(--ink)' }}>
          <span className="absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 border-b border-l bg-white" style={{ borderColor: 'rgba(51,65,92,.15)' }} />
          {text}
          <button type="button" aria-label="close" onClick={() => setOpen(false)} className="absolute right-1.5 top-1.5 text-foreground/40 hover:text-foreground/70"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

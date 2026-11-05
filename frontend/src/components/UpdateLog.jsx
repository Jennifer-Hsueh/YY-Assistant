import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { CHANGELOG } from '../content/changelog';

// 公告頁的「更新紀錄」:最新一筆展開(約 30 字),其餘只顯示短標題(約 10 字),點一下展開
export default function UpdateLog({ lang }) {
  const i = lang === 'en' ? 1 : 0;
  const [open, setOpen] = useState(() => new Set([0]));
  const [all, setAll] = useState(false);
  const shown = all ? CHANGELOG : CHANGELOG.slice(0, 8);
  const toggle = (k) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  if (!CHANGELOG.length) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-2 font-medium">🛠️ {lang === 'en' ? 'What’s new' : '更新紀錄'}</p>
        <ul className="divide-y divide-dashed divide-border">
          {shown.map((c, k) => (
            <li key={`${c.date}-${k}`}>
              <button type="button" onClick={() => toggle(k)} className="flex w-full items-center gap-3 py-2 text-left text-sm">
                <span className="w-11 shrink-0 font-amount text-xs text-muted-foreground">{Number(c.date.slice(5, 7))}/{Number(c.date.slice(8, 10))}</span>
                <span className={`min-w-0 flex-1 ${k === 0 ? 'font-medium' : ''}`}>{c.short[i]}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open.has(k) ? 'rotate-180' : ''}`} />
              </button>
              {open.has(k) && <p className="-mt-1 pb-2 pl-14 text-sm text-muted-foreground">{c.detail[i]}</p>}
            </li>
          ))}
        </ul>
        {CHANGELOG.length > 8 && (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 text-xs text-muted-foreground underline">
            {all ? (lang === 'en' ? 'Show less' : '收起') : (lang === 'en' ? `Show all (${CHANGELOG.length})` : `顯示全部（${CHANGELOG.length}）`)}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

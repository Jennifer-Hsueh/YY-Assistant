import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useSlipUnread } from '../lib/slipStatus';

// 小河狸提示泡泡:畫面左下角偶爾冒出一隻小河狸說一句話,點一下就消失
// 目前兩種:生日提醒(好友生日、顯示年紀的紀念日,今天/明天)、小紙條通知(不在首頁時)
// 同一句話一天只出現一次
const SEEN_KEY = 'yy_bubble_seen';
const todayKey = () => new Date().toLocaleDateString('sv-SE');

function readSeen() {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
    return v && v.date === todayKey() ? v.keys : [];
  } catch { return []; }
}
function markSeen(key) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ date: todayKey(), keys: [...new Set([...readSeen(), key])] })); } catch { /* ignore */ }
}

// 生日資料一天抓一次(切換頁面不重抓)
let cache = null;
async function loadBirthdays() {
  if (cache && cache.date === todayKey()) return cache.items;
  const [{ anniversaries = [], birthdays = [] }, { profile }] = await Promise.all([api.listAnniversaries(), api.getProfile()]);
  const items = [];
  if (profile?.notify_birthdays !== false) {
    for (const b of birthdays) if (b.days_left === 0 || b.days_left === 1) items.push({ kind: 'friend', id: b.id, name: b.name || '', days: b.days_left });
  }
  for (const a of anniversaries) {
    if (a.show_age && a.remind !== 'none' && (a.days_left === 0 || a.days_left === 1)) items.push({ kind: 'anniv', id: a.id, name: a.title, days: a.days_left });
  }
  items.sort((x, y) => x.days - y.days);
  cache = { date: todayKey(), items };
  return items;
}

export default function BeaverBubble() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const slipUnread = useSlipUnread();
  const [items, setItems] = useState([]);
  const [bubble, setBubble] = useState(null);

  useEffect(() => { loadBirthdays().then(setItems).catch(() => {}); }, []);

  useEffect(() => {
    if (bubble) return;
    const seen = readSeen();
    const list = [];
    // 小紙條:首頁會直接跳出紙條,所以只在其他頁面提醒
    if (slipUnread > 0 && pathname !== '/') list.push({ key: `slip-${slipUnread}`, img: 'hug', text: t('bb_slip'), go: () => navigate('/') });
    for (const it of items) {
      const key = `bd-${it.kind}-${it.id}-${it.days}`;
      if (it.kind === 'friend') {
        list.push({ key, img: 'understand', text: (it.days === 0 ? t('bb_friend_today') : t('bb_friend_tomorrow')).replace('{name}', it.name), go: () => navigate(`/?slipTo=${it.id}`) });
      } else {
        list.push({ key, img: 'understand', text: (it.days === 0 ? t('bb_anniv_today') : t('bb_anniv_tomorrow')).replace('{name}', it.name), go: () => navigate('/anniversaries') });
      }
    }
    const next = list.find((b) => !seen.includes(b.key));
    if (!next) return undefined;
    const timer = setTimeout(() => { markSeen(next.key); setBubble(next); }, 1200);
    return () => clearTimeout(timer);
  }, [items, slipUnread, pathname, bubble]);

  // 15 秒後自己收起來
  useEffect(() => {
    if (!bubble) return undefined;
    const timer = setTimeout(() => setBubble(null), 15000);
    return () => clearTimeout(timer);
  }, [bubble]);

  if (!bubble) return null;
  return (
    <div className="beaver-bubble fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-3 z-40 flex max-w-[calc(100vw-96px)] items-end gap-1.5 md:bottom-8 md:left-64 md:max-w-sm">
      <img src={`/reactions/${bubble.img}.webp`} alt="" className="h-14 w-14 shrink-0 drop-shadow md:h-16 md:w-16" />
      <div className="relative mb-6 rounded-2xl border border-border bg-card py-2 pl-3 pr-7 text-sm shadow-lg">
        <span className="absolute -left-1.5 bottom-2.5 h-3 w-3 rotate-45 border-b border-l border-border bg-card" />
        <button type="button" onClick={() => { const b = bubble; setBubble(null); b.go(); }} className="relative text-left leading-snug">{bubble.text}</button>
        <button type="button" aria-label={t('ann_close')} onClick={() => setBubble(null)} className="absolute right-1.5 top-1.5 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

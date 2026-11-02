import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';
import { setSlipUnread, useSlipUnread, refreshSlipStatus } from '../lib/slipStatus';
import { startLiveNotices } from '../lib/annStatus';

const MAX = 25;
const len = (s) => [...s].length;

// 首頁小紙條卡片上的便利貼:點一下再打開還沒看的紙條
export const openSlipPopup = () => window.dispatchEvent(new Event('yy:slip-popup'));

// 收到小紙條:不管在哪一頁都直接跳出來,一張一張看;可以在這裡直接回一張
export default function SlipPopup() {
  const { t } = useLanguage();
  const unreadCount = useSlipUnread();
  const [popup, setPopup] = useState([]);
  const [idx, setIdx] = useState(0);
  const [reply, setReply] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shown = useRef(new Set()); // 已經跳出過的紙條(點旁邊關掉後不會一直再跳)

  const changed = () => window.dispatchEvent(new Event('yy:slips-changed'));
  async function show(force = false) {
    try {
      const d = await api.listSlips();
      const fresh = d.received.filter((s) => !s.read_at && !s.hidden && (force || !shown.current.has(s.id)));
      setSlipUnread(d.received.filter((s) => !s.read_at && !s.hidden).length);
      if (!fresh.length) return;
      fresh.forEach((s) => shown.current.add(s.id));
      // 跳出來就算看過了(不用再按「收下」)
      setSlipUnread(0);
      api.readSlips(fresh.map((s) => s.id)).then(changed).catch(() => {});
      setPopup([...fresh].reverse());
      setIdx(0);
      setReply(null);
      setSent(false);
    } catch (err) {
      console.error(err);
    }
  }

  // 未讀數變多(或剛打開 App 有未讀)就跳出來
  useEffect(() => { if (unreadCount > 0 && !popup.length) show(); }, [unreadCount]);
  useEffect(() => {
    startLiveNotices(() => refreshSlipStatus(true));
    refreshSlipStatus(true);
    const onOpen = () => show(true);
    window.addEventListener('yy:slip-popup', onOpen);
    return () => window.removeEventListener('yy:slip-popup', onOpen);
  }, []);

  function close() {
    setPopup([]);
    setReply(null);
    setError('');
  }
  function next() {
    setReply(null);
    setSent(false);
    setError('');
    if (idx + 1 < popup.length) setIdx(idx + 1);
    else setPopup([]);
  }
  async function send(e) {
    e.preventDefault();
    const content = (reply || '').trim();
    const slip = popup[idx];
    if (!content || !slip?.from || len(content) > MAX) return;
    setBusy(true);
    setError('');
    try {
      await api.sendSlip({ to: slip.from.id, content });
      setSent(true);
      setTimeout(next, 1200);
    } catch (err) {
      setError(err?.message || t('slip_error'));
    } finally {
      setBusy(false);
    }
  }

  const pop = popup[idx];
  if (!pop) return null;
  const nameOf = (u) => (u ? u.name || '—' : t('slip_deleted_user'));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-6" onClick={close}>
      <div key={pop.id} className="slip-pop w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-center text-sm font-medium text-white drop-shadow">
          📝 {t('slip_new_from').replace('{name}', nameOf(pop.from))}
          {popup.length > 1 && <span className="ml-1 opacity-80">({idx + 1}/{popup.length})</span>}
        </p>
        <div className="rounded-md p-5 shadow-xl" style={{ background: 'color-mix(in srgb, var(--highlight) 30%, var(--card))', transform: 'rotate(-2deg)' }}>
          <p className="min-h-16 break-words text-lg leading-relaxed">{pop.content}</p>
          <p className="mt-3 text-right text-xs text-muted-foreground">— {nameOf(pop.from)}</p>
        </div>
        {reply !== null && pop.from ? (
          <form onSubmit={send} className="mt-4 space-y-2 rounded-md bg-card p-3 shadow-xl">
            <p className="text-xs text-muted-foreground">{t('slip_to').replace('{n}', nameOf(pop.from))}</p>
            {sent ? (
              <p className="py-2 text-center text-sm">{t('slip_sent_ok')}</p>
            ) : (
              <>
                <div className="relative">
                  <input
                    autoFocus
                    value={reply}
                    onChange={(e) => setReply([...e.target.value].slice(0, MAX).join(''))}
                    placeholder={t('slip_placeholder')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pr-12 text-sm"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{len(reply)}/{MAX}</span>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setReply(null); setError(''); }}>{t('cancel')}</Button>
                  <Button type="submit" size="sm" className="flex-1" disabled={busy || !reply.trim()}>{t('slip_send')}</Button>
                </div>
              </>
            )}
          </form>
        ) : (
          <div className="mt-4 flex gap-2">
            {pop.from && <Button variant="outline" className="flex-1 bg-card" onClick={() => setReply('')}>{t('slip_reply')}</Button>}
            <Button className="flex-1" onClick={next}>{idx + 1 < popup.length ? t('slip_next') : t('slip_keep')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

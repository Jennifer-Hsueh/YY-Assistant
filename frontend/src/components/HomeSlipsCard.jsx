import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StickyNote, PenLine, X } from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { setSlipUnread } from '../lib/slipStatus';
import { openSlipPopup } from './SlipPopup';

const MAX = 25;
const SHOW = 6;
const len = (s) => [...s].length;

// 首頁「小紙條」:收到的紙條貼在卡片上,點一下可以回一張或撕掉;也能看自己送出的(對方還沒看前可收回)
export default function HomeSlipsCard({ t, style }) {
  const [data, setData] = useState(null);
  const [view, setView] = useState('received');
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(null); // 點開的紙條 id
  const [compose, setCompose] = useState(null); // { to, content }
  const [contacts, setContacts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocking, setBlocking] = useState(null); // 要封鎖的寄件人
  const [params, setParams] = useSearchParams();

  async function load() {
    try {
      const d = await api.listSlips();
      setData(d);
    } catch (err) {
      console.error(err);
      setData({ received: [], sent: [] });
    }
  }
  useEffect(() => { load(); }, []);
  // 跳出來的紙條看過或回覆後,卡片跟著更新
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('yy:slips-changed', onChanged);
    return () => window.removeEventListener('yy:slips-changed', onChanged);
  }, []);
  // 小河狸提示「傳張小紙條祝福吧」:帶著 ?slipTo= 進首頁,直接打開寫紙條
  useEffect(() => {
    const to = params.get('slipTo');
    if (to) {
      startCompose(to);
      params.delete('slipTo');
      setParams(params, { replace: true });
    }
  }, [params]);

  async function block(user) {
    setBlocking(null);
    setOpen(null);
    setData((d) => ({ ...d, received: d.received.filter((s) => s.from?.id !== user.id) }));
    try { await api.blockUser(user.id); } catch (err) { console.error(err); load(); }
  }

  async function startCompose(to = '') {
    setError('');
    setOpen(null);
    setCompose({ to, content: '' });
    if (!contacts) {
      try { setContacts((await api.slipContacts()).contacts); } catch { setContacts([]); }
    }
  }

  async function send(e) {
    e.preventDefault();
    const content = compose.content.trim();
    if (!compose.to || !content || len(content) > MAX) return;
    setBusy(true);
    setError('');
    try {
      await api.sendSlip({ to: compose.to, content });
      setCompose(null);
      setView('sent');
      await load();
    } catch (err) {
      setError(err?.message || t('slip_error'));
    } finally {
      setBusy(false);
    }
  }

  // 標成已讀:卡片上的便利貼與選單紅點跟著更新
  function markRead(ids) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setData((d) => {
      const received = d.received.map((x) => (ids.includes(x.id) && !x.read_at ? { ...x, read_at: now } : x));
      setSlipUnread(received.filter((x) => !x.read_at).length);
      return { ...d, received };
    });
    api.readSlips(ids).catch(() => {});
  }
  async function setHidden(slip, hidden) {
    setOpen(null);
    const now = new Date().toISOString();
    setData((d) => {
      const received = d.received.map((x) => (x.id === slip.id ? { ...x, hidden, read_at: x.read_at || now } : x));
      setSlipUnread(received.filter((x) => !x.read_at).length);
      return { ...d, received };
    });
    try { await api.hideSlip(slip.id, hidden); } catch (err) { console.error(err); load(); }
  }
  const showUnread = () => openSlipPopup();

  async function remove(slip) {
    setOpen(null);
    setData((d) => ({ received: d.received.filter((s) => s.id !== slip.id), sent: d.sent.filter((s) => s.id !== slip.id) }));
    try { await api.deleteSlip(slip.id); } catch (err) { console.error(err); load(); }
  }

  const hiddenList = data ? data.received.filter((x) => x.hidden) : [];
  const list = !data ? [] : view === 'received' ? data.received.filter((x) => !x.hidden) : view === 'hidden' ? hiddenList : data.sent;
  const shown = all ? list : list.slice(0, SHOW);
  const nameOf = (u) => (u ? u.name || '—' : t('slip_deleted_user'));

  const unread = data ? data.received.filter((x) => !x.read_at && !x.hidden) : [];

  return (
    <>
    <Card className="relative z-10 border-none" style={style}>
      {/* 有還沒看的紙條:卡片上方貼一張摺角便利貼,點一下打開;看過就消失 */}
      {unread.length > 0 && (
        <button type="button" onClick={showUnread} aria-label={t('slip_new_badge')} title={t('slip_new_badge')} className="slip-sticky">
          <span className="slip-sticky-fold" />
        </button>
      )}
      <CardContent className="p-4 md:p-5">
        <div className="mb-3 flex items-center gap-1.5 text-base font-medium" style={{ color: 'var(--module-recurring)' }}>
          <StickyNote className="h-4 w-4" />
          <span className="flex-1">{t('slip_title')}</span>
          {!compose && (
            <button type="button" onClick={() => startCompose()} className="flex items-center gap-1 text-xs font-normal underline">
              <PenLine className="h-3.5 w-3.5" />{t('slip_write')}
            </button>
          )}
        </div>

        {compose && (
          <form onSubmit={send} className="mb-3 space-y-2 rounded-lg border border-border bg-card/70 p-2.5">
            {!contacts ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('slip_no_contacts')}</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Select value={compose.to || undefined} onValueChange={(v) => setCompose({ ...compose, to: v })}>
                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder={t('slip_pick')} /></SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || '—'}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button type="button" aria-label={t('cancel')} onClick={() => setCompose(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="relative">
                  <input
                    value={compose.content}
                    onChange={(e) => setCompose({ ...compose, content: [...e.target.value].slice(0, MAX).join('') })}
                    placeholder={t('slip_placeholder')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pr-12 text-sm"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{len(compose.content)}/{MAX}</span>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <Button type="submit" size="sm" className="w-full" disabled={busy || !compose.to || !compose.content.trim()}>{t('slip_send')}</Button>
              </>
            )}
            {contacts && contacts.length === 0 && (
              <button type="button" onClick={() => setCompose(null)} className="text-xs text-muted-foreground underline">{t('cancel')}</button>
            )}
          </form>
        )}

        {data && (
          <div className={`mb-3 grid ${hiddenList.length || view === 'hidden' ? 'grid-cols-3' : 'grid-cols-2'} gap-1 rounded-lg border border-border bg-card/60 p-1 text-sm`}>
            {['received', 'sent', ...(hiddenList.length || view === 'hidden' ? ['hidden'] : [])].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setView(v); setOpen(null); setAll(false); }}
                className={`rounded-md py-1.5 transition-colors ${view === v ? 'font-medium text-white shadow-sm' : 'text-muted-foreground hover:bg-muted/60'}`}
                style={view === v ? { background: 'var(--module-recurring)' } : undefined}
              >
                {t(`slip_${v}`)}
                {v === 'received' && unread.length > 0 && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: view === v ? '#fff' : 'var(--expense)' }} />}
              </button>
            ))}
          </div>
        )}

        {!data ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{view === 'received' ? t('slip_empty') : view === 'hidden' ? t('slip_empty_hidden') : t('slip_empty_sent')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {shown.map((s, i) => {
              const isOpen = open === s.id;
              const isNew = view === 'received' && !s.read_at;
              const fromSide = view !== 'sent';
              return (
                <div
                  key={s.id}
                  className="relative rounded-md p-2.5 text-sm shadow-sm transition-transform"
                  style={{ background: 'color-mix(in srgb, var(--highlight) 22%, var(--card))', transform: isOpen ? 'none' : `rotate(${i % 2 ? 1 : -1}deg)` }}
                >
                  <button type="button" onClick={() => { setOpen(isOpen ? null : s.id); if (isNew) markRead([s.id]); }} className="block w-full text-left">
                    <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      {isNew && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--expense)' }} />}
                      <span className="truncate">{fromSide ? nameOf(s.from) : `→ ${nameOf(s.to)}`}</span>
                    </p>
                    <p className="break-words leading-snug">{s.content}</p>
                    {view === 'sent' && <p className="mt-1 text-[11px] text-muted-foreground">{s.read_at ? t('slip_read') : t('slip_unread')}</p>}
                  </button>
                  {isOpen && (
                    <div className="mt-2 flex gap-3 border-t border-dashed border-border pt-1.5 text-xs text-muted-foreground">
                      {fromSide ? (
                        <>
                          {s.from && <button type="button" onClick={() => startCompose(s.from.id)} className="underline">{t('slip_reply')}</button>}
                          <button type="button" onClick={() => setHidden(s, view === 'received')} className="underline">{view === 'received' ? t('slip_hide') : t('slip_unhide')}</button>
                          <button type="button" onClick={() => remove(s)} className="underline">{t('slip_tear')}</button>
                          {s.from && <button type="button" onClick={() => setBlocking(s.from)} className="ml-auto underline">{t('slip_block')}</button>}
                        </>
                      ) : (
                        <button type="button" onClick={() => remove(s)} className="underline">{s.read_at ? t('slip_remove') : t('slip_recall')}</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {blocking && (
          <div className="mt-3 space-y-2 rounded-md border border-border bg-card p-3 text-xs">
            <p>{t('slip_block_confirm').replace('{name}', nameOf(blocking))}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => block(blocking)}>{t('slip_block_ok')}</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setBlocking(null)}>{t('cancel')}</Button>
            </div>
          </div>
        )}
        {list.length > SHOW && (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs text-muted-foreground underline">
            {all ? t('slip_less') : `${t('slip_more')}(${list.length})`}
          </button>
        )}
      </CardContent>
    </Card>
    </>
  );
}

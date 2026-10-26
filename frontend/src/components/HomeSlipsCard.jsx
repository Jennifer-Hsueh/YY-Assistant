import { useEffect, useState } from 'react';
import { StickyNote, PenLine, X } from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  const [unreadIds, setUnreadIds] = useState([]);

  async function load() {
    try {
      const d = await api.listSlips();
      setData(d);
      // 首頁看到了就算已讀;這次畫面上仍標示「新」
      const fresh = d.received.filter((s) => !s.read_at).map((s) => s.id);
      if (fresh.length) {
        setUnreadIds((ids) => [...new Set([...ids, ...fresh])]);
        api.readSlips(fresh).catch(() => {});
      }
    } catch (err) {
      console.error(err);
      setData({ received: [], sent: [] });
    }
  }
  useEffect(() => { load(); }, []);

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

  async function remove(slip) {
    setOpen(null);
    setData((d) => ({ received: d.received.filter((s) => s.id !== slip.id), sent: d.sent.filter((s) => s.id !== slip.id) }));
    try { await api.deleteSlip(slip.id); } catch (err) { console.error(err); load(); }
  }

  const list = data ? data[view] : [];
  const shown = all ? list : list.slice(0, SHOW);
  const nameOf = (u) => (u ? u.name || '—' : t('slip_deleted_user'));

  return (
    <Card className="relative z-10 border-none" style={style}>
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

        {data && (data.received.length > 0 || data.sent.length > 0) && (
          <div className="mb-2 flex gap-1.5 text-xs">
            {['received', 'sent'].map((v) => (
              <button key={v} type="button" onClick={() => { setView(v); setOpen(null); setAll(false); }} className={`rounded-full px-2.5 py-0.5 ${view === v ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'}`}>
                {t(`slip_${v}`)}
              </button>
            ))}
          </div>
        )}

        {!data ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{view === 'received' ? t('slip_empty') : t('slip_empty_sent')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {shown.map((s, i) => {
              const isOpen = open === s.id;
              const isNew = view === 'received' && unreadIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className="relative rounded-md p-2.5 text-sm shadow-sm transition-transform"
                  style={{ background: 'color-mix(in srgb, var(--highlight) 22%, var(--card))', transform: isOpen ? 'none' : `rotate(${i % 2 ? 1 : -1}deg)` }}
                >
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} className="block w-full text-left">
                    <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      {isNew && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--expense)' }} />}
                      <span className="truncate">{view === 'received' ? nameOf(s.from) : `→ ${nameOf(s.to)}`}</span>
                    </p>
                    <p className="break-words leading-snug">{s.content}</p>
                    {view === 'sent' && <p className="mt-1 text-[11px] text-muted-foreground">{s.read_at ? t('slip_read') : t('slip_unread')}</p>}
                  </button>
                  {isOpen && (
                    <div className="mt-2 flex gap-3 border-t border-dashed border-border pt-1.5 text-xs text-muted-foreground">
                      {view === 'received' ? (
                        <>
                          {s.from && <button type="button" onClick={() => startCompose(s.from.id)} className="underline">{t('slip_reply')}</button>}
                          <button type="button" onClick={() => remove(s)} className="underline">{t('slip_tear')}</button>
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
        {list.length > SHOW && (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs text-muted-foreground underline">
            {all ? t('slip_less') : `${t('slip_more')}(${list.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

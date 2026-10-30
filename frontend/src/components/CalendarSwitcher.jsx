// 共用行事曆:上方的切換選單、顯示方式(疊在一起/分開切換)、管理(新增、改名、顏色、成員、刪除/退出)、收到的邀請
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Layers, LogOut, Pencil, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';

const TEXT = {
  zh: {
    mine: '我的行事曆', all: '全部行事曆', manage: '管理共用行事曆', title: '共用行事曆',
    view: '顯示方式', overlay: '疊在一起', switch: '分開切換',
    add: '新增', namePh: '行事曆名稱，例如：家庭、約會', rename: '改名', save: '儲存', cancel: '取消', close: '關閉',
    del: '刪除', delConfirm: (n) => `刪除「${n}」會一併刪除裡面所有的行程，成員也看不到了，無法復原。`, delOk: '確定刪除',
    leave: '退出', leaveConfirm: (n, owner, alone) => `退出「${n}」後就看不到裡面的行程了。${alone ? '目前沒有其他成員，這本行事曆會一起刪除。' : owner ? '行事曆會交給最早加入的成員管理。' : ''}`, leaveOk: '確定退出',
    members: '成員', creator: '建立者', invited: '邀請中', you: '（你）', invitePick: '選擇好友', inviteSend: '邀請', noFriends: '咦？空的？',
    remove: '移出', inviteFrom: (from, n) => `${from || '好友'} 邀請你加入共用行事曆「${n}」`, join: '加入', decline: '拒絕',
    empty: '還沒有共用行事曆。建立一本，再邀請好友加入，大家都能看到、新增和修改裡面的行程。', unnamed: '未設定稱呼', color: '顏色',
  },
  en: {
    mine: 'My calendar', all: 'All calendars', manage: 'Manage shared calendars', title: 'Shared calendars',
    view: 'Display', overlay: 'Combined', switch: 'One at a time',
    add: 'Add', namePh: 'Calendar name, e.g. Family, Dates', rename: 'Rename', save: 'Save', cancel: 'Cancel', close: 'Close',
    del: 'Delete', delConfirm: (n) => `Deleting "${n}" also deletes all its events for every member. This cannot be undone.`, delOk: 'Delete',
    leave: 'Leave', leaveConfirm: (n, owner, alone) => `After leaving "${n}" you won't see its events.${alone ? ' There are no other members, so it will be deleted.' : owner ? ' The earliest member will take it over.' : ''}`, leaveOk: 'Leave',
    members: 'Members', creator: 'Creator', invited: 'Invited', you: ' (you)', invitePick: 'Choose a friend', inviteSend: 'Invite', noFriends: 'Huh? Nobody here?',
    remove: 'Remove', inviteFrom: (from, n) => `${from || 'A friend'} invited you to the shared calendar "${n}"`, join: 'Join', decline: 'Decline',
    empty: 'No shared calendars yet. Create one and invite friends; everyone can see, add and edit its events.', unnamed: 'No name', color: 'Color',
  },
};
const useT = () => { const { language } = useLanguage(); return TEXT[language] || TEXT.zh; };
export const CAL_COLORS = ['#C1666B', '#6E8B5D', '#4C7A9E', '#B08238', '#8E6BA8', '#D9822B', '#3F8F8B', '#9A6B4F'];

function Members({ c, run, busy }) {
  const T = useT();
  const { user } = useAuth();
  const [friends, setFriends] = useState(null);
  const [pick, setPick] = useState('');
  const isOwner = c.role === 'owner';
  const name = (n) => n || T.unnamed;
  useEffect(() => { api.getFriends().then((d) => setFriends(d.friends)).catch(() => setFriends([])); }, []);
  const taken = new Set([c.owner?.id, ...(c.members || []).map((m) => m.id)]);
  const candidates = (friends || []).filter((f) => !taken.has(f.id));
  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2.5">
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center gap-2">
          <span className="flex-1 truncate">{name(c.owner?.name)}{c.owner?.id === user?.id && T.you}</span>
          <span className="text-xs text-muted-foreground">{T.creator}</span>
        </li>
        {(c.members || []).map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <span className={`flex-1 truncate ${m.status === 'active' ? '' : 'text-muted-foreground'}`}>{name(m.name)}{m.id === user?.id && T.you}</span>
            {m.status === 'invited' && <span className="text-xs text-muted-foreground">{T.invited}</span>}
            {isOwner && (
              <button type="button" aria-label={T.remove} disabled={busy} onClick={() => run(() => api.removeCalendarMember(c.id, m.id))} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            )}
          </li>
        ))}
      </ul>
      {friends && (candidates.length ? (
        <div className="flex gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">{T.invitePick}</option>
            {candidates.map((f) => <option key={f.id} value={f.id}>{name(f.name)}</option>)}
          </select>
          <Button size="sm" disabled={busy || !pick} onClick={async () => { if (await run(() => api.inviteToCalendar(c.id, pick))) setPick(''); }}><UserPlus className="h-4 w-4" />{T.inviteSend}</Button>
        </div>
      ) : <p className="text-xs text-muted-foreground">{T.noFriends}</p>)}
    </div>
  );
}

export function ColorDots({ value, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAL_COLORS.map((col) => (
        <button key={col} type="button" aria-label={col} onClick={() => onPick(col)}
          className={`h-6 w-6 rounded-full border-2 ${value === col ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: col }} />
      ))}
    </div>
  );
}

function Row({ c, run, busy }) {
  const T = useT();
  const [mode, setMode] = useState(null); // rename | delete | leave | members | color
  const [newName, setNewName] = useState(c.name);
  const iconBtn = 'rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30';
  const activeMembers = (c.members || []).filter((m) => m.status === 'active').length;
  return (
    <li className="px-3 py-2.5">
      {mode === 'rename' ? (
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api.updateCalendar(c.id, { name: newName }))) setMode(null); }}>
          <Input autoFocus maxLength={20} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" size="sm" disabled={busy || !newName.trim()}>{T.save}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)}>{T.cancel}</Button>
        </form>
      ) : mode === 'delete' || mode === 'leave' ? (
        <div className="space-y-2">
          <p className="text-sm">{mode === 'delete' ? T.delConfirm(c.name) : T.leaveConfirm(c.name, c.role === 'owner', c.role === 'owner' && activeMembers === 0)}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>{T.cancel}</Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={async () => {
              if (await run(() => (mode === 'delete' ? api.deleteCalendar(c.id) : api.leaveCalendar(c.id)))) setMode(null);
            }}>{mode === 'delete' ? T.delOk : T.leaveOk}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label={T.color} onClick={() => setMode(mode === 'color' ? null : 'color')} className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
            {activeMembers > 0 && <Users className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <button type="button" aria-label={T.members} onClick={() => setMode(mode === 'members' ? null : 'members')} className={iconBtn}><UserPlus className="h-4 w-4" /></button>
            <button type="button" aria-label={T.rename} onClick={() => { setNewName(c.name); setMode('rename'); }} className={iconBtn}><Pencil className="h-4 w-4" /></button>
            {c.role === 'owner' && activeMembers === 0 ? (
              <button type="button" aria-label={T.del} onClick={() => setMode('delete')} className={iconBtn}><Trash2 className="h-4 w-4" /></button>
            ) : (
              <button type="button" aria-label={T.leave} onClick={() => setMode('leave')} className={iconBtn}><LogOut className="h-4 w-4" /></button>
            )}
          </div>
          {mode === 'members' && <Members c={c} run={run} busy={busy} />}
          {mode === 'color' && <div className="mt-2"><ColorDots value={c.color} onPick={(col) => run(() => api.updateCalendar(c.id, { color: col })).then(() => setMode(null))} /></div>}
        </>
      )}
    </li>
  );
}

function ManageDialog({ calendars, reload, onClose, onCreated }) {
  const T = useT();
  const [newName, setNewName] = useState('');
  const [color, setColor] = useState(CAL_COLORS[calendars.length % CAL_COLORS.length]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); await reload(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  async function add(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    let created;
    if (await run(async () => { created = (await api.createCalendar({ name: newName.trim(), color })).calendar; })) {
      setNewName('');
      onCreated?.(created.id);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">{T.title}</p>
          <button type="button" onClick={onClose} aria-label={T.close} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {calendars.length ? (
          <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
            {calendars.map((c) => <Row key={c.id} c={c} run={run} busy={busy} />)}
          </ul>
        ) : <p className="mb-4 text-sm text-muted-foreground">{T.empty}</p>}
        <form onSubmit={add} className="space-y-2">
          <div className="flex gap-2">
            <Input maxLength={20} placeholder={T.namePh} value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button type="submit" disabled={busy || !newName.trim()} className="shrink-0"><Plus className="h-4 w-4" />{T.add}</Button>
          </div>
          <ColorDots value={color} onPick={setColor} />
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// 收到的共用行事曆邀請(首頁、行事曆頁)
export function CalendarInvites({ invites: given, onChanged }) {
  const T = useT();
  const [own, setOwn] = useState([]);
  const [busy, setBusy] = useState(false);
  const controlled = Array.isArray(given);
  const load = () => api.listCalendars().then((d) => setOwn(d.invites || [])).catch(() => {});
  useEffect(() => { if (!controlled) load(); }, [controlled]);
  const invites = controlled ? given : own;
  if (!invites.length) return null;
  async function answer(inv, join) {
    setBusy(true);
    try { await (join ? api.acceptCalendarInvite(inv.calendar_id) : api.declineCalendarInvite(inv.calendar_id)); } catch { /* 邀請可能已被取消 */ }
    finally { setBusy(false); if (!controlled) load(); onChanged?.(join ? inv.calendar_id : null); }
  }
  return (
    <div className="mb-3 space-y-2">
      {invites.map((inv) => (
        <div key={inv.calendar_id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <CalendarDays className="h-4 w-4 shrink-0" style={{ color: 'var(--module-calendar)' }} />
          <span className="min-w-0 flex-1 text-sm">{T.inviteFrom(inv.from, inv.name)}</span>
          <Button size="sm" disabled={busy} onClick={() => answer(inv, true)}>{T.join}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => answer(inv, false)}>{T.decline}</Button>
        </div>
      ))}
    </div>
  );
}

// 行事曆頁上方:目前看的行事曆(分開切換時)或「全部行事曆」(疊在一起時)
export default function CalendarSwitcher({ calendars, mode, setMode, current, setCurrent, reload, canEdit }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const cur = calendars.find((c) => c.id === current);
  const label = mode === 'overlay' ? T.all : cur ? cur.name : T.mine;
  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60';
  return (
    <div ref={ref} className="relative mb-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted/50">
        {mode === 'overlay' ? <Layers className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          : cur ? <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cur.color }} /> : <CalendarDays className="h-4 w-4" style={{ color: 'var(--primary)' }} />}
        <span className="max-w-[12rem] truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          <p className="px-3 pb-1 pt-1.5 text-[11px] text-muted-foreground">{T.view}</p>
          <div className="mx-3 mb-1.5 flex rounded-md border border-border p-0.5 text-xs">
            {[['overlay', T.overlay], ['switch', T.switch]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMode(k)} className={`flex-1 rounded px-2 py-1 ${mode === k ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{l}</button>
            ))}
          </div>
          {mode === 'switch' && (
            <>
              <div className="my-1 border-t border-border" />
              {[{ id: '', name: T.mine }, ...calendars].map((c) => (
                <button key={c.id || 'mine'} type="button" onClick={() => { setOpen(false); setCurrent(c.id); }} className={item}>
                  <span className="w-4">{(current || '') === c.id && <Check className="h-4 w-4" style={{ color: 'var(--primary)' }} />}</span>
                  {c.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} /> : <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {(c.members || []).some((m) => m.status === 'active') && <Users className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ))}
            </>
          )}
          {mode === 'overlay' && calendars.length > 0 && (
            <div className="px-3 pb-1.5 text-xs text-muted-foreground">
              {calendars.map((c) => (
                <span key={c.id} className="mr-2 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
              ))}
            </div>
          )}
          {canEdit && (
            <>
              <div className="my-1 border-t border-border" />
              <button type="button" onClick={() => { setOpen(false); setManaging(true); }} className={`${item} text-muted-foreground`}>
                <span className="w-4"><Pencil className="h-3.5 w-3.5" /></span>{T.manage}
              </button>
            </>
          )}
        </div>
      )}
      {managing && <ManageDialog calendars={calendars} reload={reload} onClose={() => setManaging(false)} onCreated={(id) => { if (mode === 'switch') setCurrent(id); }} />}
    </div>
  );
}

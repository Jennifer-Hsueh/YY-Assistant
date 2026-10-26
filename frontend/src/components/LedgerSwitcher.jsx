import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, LogOut, Pencil, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLedger } from '../context/LedgerContext';
import { useLanguage } from '../context/LanguageContext';
import { usePlan } from '../context/PlanContext';
import { Button } from './ui/button';
import { Input } from './ui/input';

const TEXT = {
  zh: {
    manage: '管理帳本', title: '管理帳本', add: '新增帳本', namePh: '帳本名稱，例如：旅遊、家用',
    rename: '改名', del: '刪除', save: '儲存', cancel: '取消', close: '關閉',
    defaultTag: '預設', leftTag: '已退出',
    delConfirm: (n) => `刪除「${n}」會一併刪除裡面所有的記帳、帳戶、預算與循環記帳，無法復原。`,
    delOk: '確定刪除', lastOne: '至少要保留一本帳本',
    members: '成員', creator: '建立者', invited: '邀請中', left: '已退出', you: '（你）',
    invite: '邀請好友', invitePick: '選擇好友', inviteSend: '邀請', noFriends: '咦？空的？',
    remove: '移出', removeConfirm: (n) => `確定把 ${n} 移出這本帳本？移出後對方就看不到這本帳本。`,
    leave: '退出', leaveConfirm: (n, owner, alone) => `退出「${n}」後，你仍然可以查看，但不能再新增、修改或刪除。${alone ? '目前沒有其他成員，帳本會失效，所有人都只能查看。' : owner ? '帳本會交給最早加入的成員管理。' : ''}`,
    leaveOk: '確定退出',
    hide: '從清單移除', hideConfirm: (n) => `從清單移除「${n}」後就看不到這本帳本了。`,
    inviteFrom: (from, n) => `${from || '好友'} 邀請你加入「${n}」`, join: '加入', decline: '拒絕',
    readOnly: '你已退出這本帳本，只能查看',
    archived: '這本帳本已失效，只能查看',
    unnamed: '未設定稱呼',
  },
  en: {
    manage: 'Manage ledgers', title: 'Manage ledgers', add: 'Add ledger', namePh: 'Ledger name, e.g. Travel, Household',
    rename: 'Rename', del: 'Delete', save: 'Save', cancel: 'Cancel', close: 'Close',
    defaultTag: 'Default', leftTag: 'Left',
    delConfirm: (n) => `Deleting "${n}" also deletes all its records, accounts, budgets and recurring items. This cannot be undone.`,
    delOk: 'Delete', lastOne: 'You need to keep at least one ledger',
    members: 'Members', creator: 'Creator', invited: 'Invited', left: 'Left', you: ' (you)',
    invite: 'Invite a friend', invitePick: 'Choose a friend', inviteSend: 'Invite', noFriends: 'Huh? Nobody here?',
    remove: 'Remove', removeConfirm: (n) => `Remove ${n} from this ledger? They will no longer see it.`,
    leave: 'Leave', leaveConfirm: (n, owner, alone) => `After leaving "${n}" you can still view it but cannot add, edit or delete.${alone ? ' There are no other members, so the ledger will be closed and view-only for everyone.' : owner ? ' The earliest member will take over the ledger.' : ''}`,
    leaveOk: 'Leave',
    hide: 'Remove from list', hideConfirm: (n) => `Remove "${n}" from your list? You will no longer see it.`,
    inviteFrom: (from, n) => `${from || 'A friend'} invited you to "${n}"`, join: 'Join', decline: 'Decline',
    readOnly: 'You left this ledger. It is view-only.',
    archived: 'This ledger is closed and view-only.',
    unnamed: 'No name',
  },
};
const useT = () => { const { language } = useLanguage(); return TEXT[language] || TEXT.zh; };

// 成員清單+邀請好友(建立者可以移出成員)
function Members({ l, run, busy }) {
  const T = useT();
  const { user } = useAuth();
  const [friends, setFriends] = useState(null);
  const [pick, setPick] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const isOwner = l.role === 'owner';
  const name = (n) => n || T.unnamed;

  useEffect(() => { api.getFriends().then((d) => setFriends(d.friends)).catch(() => setFriends([])); }, []);
  const taken = new Set([l.owner?.id, ...(l.members || []).filter((m) => m.status !== 'left').map((m) => m.id)]);
  const candidates = (friends || []).filter((f) => !taken.has(f.id));

  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2.5">
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center gap-2">
          <span className="flex-1 truncate">{name(l.owner?.name)}{l.owner?.id === user?.id && T.you}</span>
          <span className="text-xs text-muted-foreground">{T.creator}</span>
        </li>
        {(l.members || []).map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <span className={`flex-1 truncate ${m.status === 'active' ? '' : 'text-muted-foreground'}`}>{name(m.name)}{m.id === user?.id && T.you}</span>
            {m.status !== 'active' && <span className="text-xs text-muted-foreground">{m.status === 'invited' ? T.invited : T.left}</span>}
            {isOwner && m.status !== 'left' && (confirmRemove === m.id ? (
              <span className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setConfirmRemove(null)}>{T.cancel}</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(() => api.removeLedgerMember(l.id, m.id))}>{T.remove}</Button>
              </span>
            ) : (
              <button type="button" aria-label={T.remove} onClick={() => setConfirmRemove(m.id)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            ))}
          </li>
        ))}
      </ul>
      {confirmRemove && <p className="text-xs text-muted-foreground">{T.removeConfirm(name((l.members || []).find((m) => m.id === confirmRemove)?.name))}</p>}
      {l.can_write && friends && (candidates.length ? (
        <div className="flex gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">{T.invitePick}</option>
            {candidates.map((f) => <option key={f.id} value={f.id}>{name(f.name)}</option>)}
          </select>
          <Button size="sm" disabled={busy || !pick} onClick={async () => { if (await run(() => api.inviteToLedger(l.id, pick))) setPick(''); }}><UserPlus className="h-4 w-4" />{T.inviteSend}</Button>
        </div>
      ) : <p className="text-xs text-muted-foreground">{T.noFriends}</p>)}
    </div>
  );
}

function LedgerRow({ l, count, run, busy, onSelectAfterRemove }) {
  const T = useT();
  const { can } = usePlan();
  const writable = can('ledger') && l.can_write;
  const [mode, setMode] = useState(null); // rename | delete | leave | hide | members
  const [newName, setNewName] = useState(l.name);
  const shared = l.shared || (l.members || []).length > 0;

  const iconBtn = 'rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30';
  return (
    <li className="px-3 py-2.5">
      {mode === 'rename' ? (
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api.renameLedger(l.id, newName))) setMode(null); }}>
          <Input autoFocus maxLength={20} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" size="sm" disabled={busy || !newName.trim()}>{T.save}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)}>{T.cancel}</Button>
        </form>
      ) : ['delete', 'leave', 'hide'].includes(mode) ? (
        <div className="space-y-2">
          <p className="text-sm">{mode === 'delete' ? T.delConfirm(l.name) : mode === 'leave' ? T.leaveConfirm(l.name, l.role === 'owner', l.role === 'owner' && !l.shared) : T.hideConfirm(l.name)}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>{T.cancel}</Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={async () => {
              const fn = mode === 'delete' ? () => api.deleteLedger(l.id) : mode === 'leave' ? () => api.leaveLedger(l.id) : () => api.hideLedger(l.id);
              if (await run(fn)) { setMode(null); if (mode !== 'leave') onSelectAfterRemove(l.id); }
            }}>{mode === 'delete' ? T.delOk : mode === 'leave' ? T.leaveOk : T.hide}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            {shared && <Users className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className={`min-w-0 flex-1 truncate text-sm ${l.role === 'left' ? 'text-muted-foreground' : ''}`}>{l.name}</span>
            {l.is_default && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{T.defaultTag}</span>}
            {l.role === 'left' && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{T.leftTag}</span>}
            {l.role !== 'left' && (
              <button type="button" aria-label={T.members} onClick={() => setMode(mode === 'members' ? null : 'members')} className={iconBtn}><UserPlus className="h-4 w-4" /></button>
            )}
            {writable && <button type="button" aria-label={T.rename} onClick={() => { setNewName(l.name); setMode('rename'); }} className={iconBtn}><Pencil className="h-4 w-4" /></button>}
            {l.role === 'left' ? (
              <button type="button" aria-label={T.hide} onClick={() => setMode('hide')} className={iconBtn}><Trash2 className="h-4 w-4" /></button>
            ) : l.was_shared ? (
              // 共同帳本不能刪除,只能退出
              <button type="button" aria-label={T.leave} onClick={() => setMode('leave')} className={iconBtn}><LogOut className="h-4 w-4" /></button>
            ) : writable && (
              <button type="button" aria-label={T.del} disabled={count <= 1} title={count <= 1 ? T.lastOne : undefined} onClick={() => setMode('delete')} className={iconBtn}><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
          {mode === 'members' && <Members l={l} run={run} busy={busy} />}
        </>
      )}
    </li>
  );
}

function ManageDialog({ onClose }) {
  const T = useT();
  const { ledgers, currentId, select, reload } = useLedger();
  const { can } = usePlan();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ownCount = ledgers.filter((l) => l.role === 'owner').length;

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); await reload(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  async function add(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    let created;
    if (await run(async () => { created = (await api.createLedger(newName.trim())).ledger; })) {
      setNewName('');
      select(created.id); // 新增後直接切換過去
      onClose();
    }
  }
  // 刪除或移除的是目前帳本:切到另一本
  const afterRemove = (id) => {
    if (id !== currentId) return;
    const next = ledgers.find((x) => x.id !== id && x.is_default) || ledgers.find((x) => x.id !== id);
    if (next) select(next.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">{T.title}</p>
          <button type="button" onClick={onClose} aria-label={T.close} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {ledgers.map((l) => <LedgerRow key={l.id} l={l} count={ownCount} run={run} busy={busy} onSelectAfterRemove={afterRemove} />)}
        </ul>
        {can('ledger') && (
          <form onSubmit={add} className="flex gap-2">
            <Input maxLength={20} placeholder={T.namePh} value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button type="submit" disabled={busy || !newName.trim()} className="shrink-0"><Plus className="h-4 w-4" />{T.add}</Button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// 收到的共同帳本邀請
export function LedgerInvites({ compact = false }) {
  const T = useT();
  const { invites, reload, select } = useLedger();
  const [busy, setBusy] = useState(false);
  if (!invites.length) return null;
  async function answer(inv, join) {
    setBusy(true);
    try {
      await (join ? api.acceptLedgerInvite(inv.ledger_id) : api.declineLedgerInvite(inv.ledger_id));
      await reload();
      if (join) select(inv.ledger_id);
    } catch { /* 邀請可能已被取消:重新整理清單 */ await reload(); } finally { setBusy(false); }
  }
  return (
    <div className={compact ? 'border-b border-border px-3 py-2' : 'mb-3 space-y-2'}>
      {invites.map((inv) => (
        <div key={inv.ledger_id} className={`flex items-center gap-2 ${compact ? 'py-1' : 'rounded-lg border border-border bg-card px-3 py-2 shadow-sm'}`}>
          <BookOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--module-transactions)' }} />
          <span className="min-w-0 flex-1 text-sm">{T.inviteFrom(inv.from, inv.name)}</span>
          <Button size="sm" disabled={busy} onClick={() => answer(inv, true)}>{T.join}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => answer(inv, false)}>{T.decline}</Button>
        </div>
      ))}
    </div>
  );
}

// 記帳各頁上方:目前帳本,點開可切換或管理
export default function LedgerSwitcher() {
  const T = useT();
  const { ledgers, invites, current, currentId, select } = useLedger();
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  if (!current) return null;
  return (
    <>
      <LedgerInvites />
      <div ref={ref} className="relative mb-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted/50">
          {current.shared ? <Users className="h-4 w-4" style={{ color: 'var(--primary)' }} /> : <BookOpen className="h-4 w-4" style={{ color: 'var(--primary)' }} />}
          <span className="max-w-[12rem] truncate">{current.name}</span>
          {invites.length > 0 && <span className="h-2 w-2 rounded-full bg-destructive" />}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
            {ledgers.map((l) => (
              <button key={l.id} type="button" onClick={() => { setOpen(false); if (l.id !== currentId) select(l.id); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60">
                <span className="w-4">{l.id === currentId && <Check className="h-4 w-4" style={{ color: 'var(--primary)' }} />}</span>
                <span className={`min-w-0 flex-1 truncate ${l.role === 'left' ? 'text-muted-foreground' : ''}`}>{l.name}</span>
                {l.role === 'left' ? <span className="text-[11px] text-muted-foreground">{T.leftTag}</span> : l.shared && <Users className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button type="button" onClick={() => { setOpen(false); setManaging(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60">
              <span className="w-4"><Pencil className="h-3.5 w-3.5" /></span>{T.manage}
            </button>
          </div>
        )}
        {managing && <ManageDialog onClose={() => setManaging(false)} />}
      </div>
      {current.role === 'left' && <p className="-mt-1 mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{current.archived ? T.archived : T.readOnly}</p>}
    </>
  );
}

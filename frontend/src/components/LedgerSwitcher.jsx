import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLedger } from '../context/LedgerContext';
import { useLanguage } from '../context/LanguageContext';
import { usePlan } from '../context/PlanContext';
import { Button } from './ui/button';
import { Input } from './ui/input';

const TEXT = {
  zh: {
    manage: '管理帳本', title: '管理帳本', add: '新增帳本', namePh: '帳本名稱，例如：旅遊、家用',
    rename: '改名', del: '刪除', save: '儲存', cancel: '取消', close: '關閉',
    defaultTag: '預設',
    delConfirm: (n) => `刪除「${n}」會一併刪除裡面所有的記帳、帳戶、預算與循環記帳，無法復原。`,
    delOk: '確定刪除',
    lastOne: '至少要保留一本帳本',
  },
  en: {
    manage: 'Manage ledgers', title: 'Manage ledgers', add: 'Add ledger', namePh: 'Ledger name, e.g. Travel, Household',
    rename: 'Rename', del: 'Delete', save: 'Save', cancel: 'Cancel', close: 'Close',
    defaultTag: 'Default',
    delConfirm: (n) => `Deleting "${n}" also deletes all its records, accounts, budgets and recurring items. This cannot be undone.`,
    delOk: 'Delete',
    lastOne: 'You need to keep at least one ledger',
  },
};

function ManageDialog({ onClose }) {
  const { language } = useLanguage();
  const T = TEXT[language] || TEXT.zh;
  const { ledgers, currentId, select, reload } = useLedger();
  const { can } = usePlan();
  const writable = can('ledger');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(null);
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
    if (await run(async () => { created = (await api.createLedger(newName.trim())).ledger; })) {
      setNewName('');
      select(created.id); // 新增後直接切換過去
      onClose();
    }
  }
  async function remove(l) {
    const wasCurrent = l.id === currentId;
    if (await run(() => api.deleteLedger(l.id))) {
      setDeleting(null);
      if (wasCurrent) {
        const next = ledgers.find((x) => x.id !== l.id);
        if (next) select(next.id);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">{T.title}</p>
          <button type="button" onClick={onClose} aria-label={T.close} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {ledgers.map((l) => (
            <li key={l.id} className="px-3 py-2.5">
              {editing?.id === l.id ? (
                <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api.renameLedger(l.id, editing.name))) setEditing(null); }}>
                  <Input autoFocus maxLength={20} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <Button type="submit" size="sm" disabled={busy || !editing.name.trim()}>{T.save}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>{T.cancel}</Button>
                </form>
              ) : deleting === l.id ? (
                <div className="space-y-2">
                  <p className="text-sm">{T.delConfirm(l.name)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDeleting(null)}>{T.cancel}</Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => remove(l)}>{T.delOk}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                  {l.is_default && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{T.defaultTag}</span>}
                  {writable && (
                    <>
                      <button type="button" aria-label={T.rename} onClick={() => setEditing({ id: l.id, name: l.name })} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label={T.del} disabled={ledgers.length <= 1} title={ledgers.length <= 1 ? T.lastOne : undefined}
                        onClick={() => setDeleting(l.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {writable && (
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

// 記帳各頁上方:目前帳本,點開可切換或管理
export default function LedgerSwitcher() {
  const { language } = useLanguage();
  const T = TEXT[language] || TEXT.zh;
  const { ledgers, current, currentId, select } = useLedger();
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
    <div ref={ref} className="relative mb-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted/50">
        <BookOpen className="h-4 w-4" style={{ color: 'var(--primary)' }} />
        <span className="max-w-[12rem] truncate">{current.name}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          {ledgers.map((l) => (
            <button key={l.id} type="button" onClick={() => { setOpen(false); if (l.id !== currentId) select(l.id); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60">
              <span className="w-4">{l.id === currentId && <Check className="h-4 w-4" style={{ color: 'var(--primary)' }} />}</span>
              <span className="truncate">{l.name}</span>
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
  );
}

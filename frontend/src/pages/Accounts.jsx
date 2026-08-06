import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import LedgerSubNav from '../components/LedgerSubNav';

const CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'GBP'];

const CARD_COLORS = ['bg-primary', 'bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600'];

export default function Accounts() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState('add');

  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState('TWD');

  const [pickedId, setPickedId] = useState(null);
  const [editName, setEditName] = useState('');
  const [actionError, setActionError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { accounts } = await api.listAccounts();
      setAccounts(accounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function switchMode(newMode) {
    setMode(newMode);
    setPickedId(null);
    setEditName('');
    setActionError('');
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName) return;
    await api.createAccount({ name: newName, balance: 0, currency: newCurrency });
    setNewName('');
    load();
  }

  function pickForEdit(acc) {
    setPickedId(acc.id);
    setEditName(acc.name);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    setActionError('');
    try {
      await api.updateAccount(pickedId, { name: editName.trim() });
      switchMode('edit');
      load();
    } catch (err) {
      console.error(err);
      setActionError(t('acc_update_failed'));
    }
  }

  async function confirmDelete() {
    setActionError('');
    try {
      await api.deleteAccount(pickedId);
      switchMode('delete');
      load();
    } catch (err) {
      console.error(err);
      setActionError(t('acc_delete_failed'));
    }
  }

  const pickingMode = (mode === 'edit' || mode === 'delete') && !pickedId;
  const pickedAccount = accounts.find((a) => a.id === pickedId);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24" style={{ '--primary': 'var(--module-accounts)', '--ring': 'var(--module-accounts)' }}>
      <h1 className="mb-3 text-lg font-semibold">{t('acc_pageTitle')}</h1>
      <LedgerSubNav />

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : accounts.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">{t('acc_no_accounts')}</p>
      ) : (
        <div className="relative mb-6 h-40">
          {accounts.map((acc, idx) => {
            const offset = idx - activeIndex;
            if (Math.abs(offset) > 2) return null;
            return (
              <button
                key={acc.id}
                onClick={() => setActiveIndex(idx)}
                className={`absolute inset-x-0 h-36 rounded-2xl p-4 text-left text-white shadow-lg transition-all ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                style={{ top: `${Math.abs(offset) * 10}px`, transform: `scale(${1 - Math.abs(offset) * 0.05})`, zIndex: 10 - Math.abs(offset), opacity: Math.abs(offset) > 1 ? 0.5 : 1 }}
              >
                <p className="text-sm opacity-80">{acc.name}</p>
                <p className="mt-4 text-2xl font-semibold">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
        <button onClick={() => switchMode('add')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${mode === 'add' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_add')}</button>
        <button onClick={() => switchMode('edit')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${mode === 'edit' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_edit')}</button>
        <button onClick={() => switchMode('delete')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${mode === 'delete' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_delete')}</button>
      </div>

      <Card>
        <CardContent className="p-4">
          {mode === 'add' && (
            <form onSubmit={handleAdd} className="flex gap-2">
              <Input type="text" placeholder={t('acc_new_name_placeholder')} value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Select value={newCurrency} onValueChange={setNewCurrency}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit">{t('acc_add')}</Button>
            </form>
          )}

          {mode === 'edit' && pickingMode && (
            <div className="space-y-1">
              <p className="mb-2 text-sm text-muted-foreground">{t('acc_pick_rename')}</p>
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => pickForEdit(acc)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <span>{acc.name}</span>
                  <span className="text-muted-foreground">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'edit' && pickedId && (
            <div className="space-y-2">
              {actionError && <p className="text-sm text-red-500">{actionError}</p>}
              <Input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <div className="flex gap-2">
                <Button type="button" className="flex-1" onClick={saveEdit}>{t('save')}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPickedId(null)}>{t('reselect')}</Button>
              </div>
            </div>
          )}

          {mode === 'delete' && pickingMode && (
            <div className="space-y-1">
              <p className="mb-2 text-sm text-muted-foreground">{t('acc_pick_delete')}</p>
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setPickedId(acc.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <span>{acc.name}</span>
                  <span className="text-muted-foreground">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'delete' && pickedId && (
            <div className="space-y-2">
              {actionError && <p className="text-sm text-red-500">{actionError}</p>}
              <p className="text-sm font-medium">{t('acc_confirm_delete_prefix')}{pickedAccount?.name}{t('acc_confirm_delete_suffix')}</p>
              <p className="text-xs text-muted-foreground">{t('acc_delete_note')}</p>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" onClick={confirmDelete}>{t('tx_confirm_delete')}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPickedId(null)}>{t('reselect')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

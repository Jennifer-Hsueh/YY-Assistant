import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

function todayLocal() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function toLocalDateInput(isoString) {
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

const emptyForm = { type: 'expense', amount: '', category: '', note: '', account_id: '', occurred_at: todayLocal() };
const emptyTransfer = { from: '', to: '', amount: '' };

export default function Transactions() {
  const { t } = useLanguage();
  const [view, setView] = useState('list');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const [actionMode, setActionMode] = useState('add');
  const [activeId, setActiveId] = useState(null);

  const [transfer, setTransfer] = useState(emptyTransfer);
  const [transferError, setTransferError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [{ transactions }, { accounts }, { categories }] = await Promise.all([
        api.listTransactions(),
        api.listAccounts(),
        api.listCategories(),
      ]);
      setTransactions(transactions);
      setAccounts(accounts);
      setCategories(categories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function switchActionMode(newMode) {
    setActionMode(newMode);
    setActiveId(null);
    setForm(emptyForm);
    setTransfer(emptyTransfer);
    setTransferError('');
  }

  function pickTransaction(t) {
    setActiveId(t.id);
    setForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category || '',
      note: t.note || '',
      account_id: t.account_id || '',
      occurred_at: toLocalDateInput(t.occurred_at),
    });
  }

  function resetAfterAction() {
    setForm(emptyForm);
    setActionMode('add');
    setActiveId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount) return;
    const occurredAtIso = new Date(`${form.occurred_at}T12:00:00`).toISOString();
    const payload = {
      type: form.type,
      amount: Number(form.amount),
      category: form.category || null,
      note: form.note || null,
      account_id: form.account_id || null,
      occurred_at: occurredAtIso,
    };

    if (actionMode === 'edit' && activeId) {
      await api.updateTransaction(activeId, payload);
    } else {
      await api.createTransaction(payload);
    }
    resetAfterAction();
    load();
  }

  async function handleConfirmDelete() {
    await api.deleteTransaction(activeId);
    resetAfterAction();
    load();
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setTransferError('');
    if (!transfer.from || !transfer.to || !transfer.amount) return;
    if (transfer.from === transfer.to) {
      setTransferError(t('tx_transfer_error_same'));
      return;
    }
    try {
      await api.transferBetweenAccounts({
        from_account_id: transfer.from,
        to_account_id: transfer.to,
        amount: Number(transfer.amount),
      });
      setTransfer(emptyTransfer);
      load();
    } catch (err) {
      console.error(err);
      setTransferError(t('tx_transfer_error_fail'));
    }
  }

  const grouped = transactions.reduce((acc, t) => {
    const day = t.occurred_at.slice(0, 10);
    (acc[day] ||= []).push(t);
    return acc;
  }, {});

  function accountName(id) {
    return accounts.find((a) => a.id === id)?.name;
  }

  const pickingMode = (actionMode === 'edit' || actionMode === 'delete') && !activeId;
  const relevantCategories = categories.filter((c) => c.type === form.type || c.type === 'general');

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('tx_pageTitle')}</h1>
        <div className="flex rounded-lg bg-muted p-1 text-sm">
          <button onClick={() => setView('list')} className={`rounded-md px-3 py-1 transition-colors ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{t('tx_view_list')}</button>
          <button onClick={() => setView('calendar')} className={`rounded-md px-3 py-1 transition-colors ${view === 'calendar' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{t('tx_view_calendar')}</button>
        </div>
      </div>

      <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
        <button onClick={() => switchActionMode('add')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'add' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_add')}</button>
        <button onClick={() => switchActionMode('edit')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'edit' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_edit')}</button>
        <button onClick={() => switchActionMode('delete')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'delete' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_delete')}</button>
        <button onClick={() => switchActionMode('transfer')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'transfer' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_transfer')}</button>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-2 p-4">
          {actionMode === 'transfer' ? (
            <form onSubmit={handleTransfer} className="space-y-2">
              {transferError && <p className="text-sm text-red-500">{transferError}</p>}
              <Select value={transfer.from || 'none'} onValueChange={(v) => setTransfer({ ...transfer, from: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder={t('tx_transfer_from')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tx_transfer_from')}</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}(NT$ {Number(acc.balance).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={transfer.to || 'none'} onValueChange={(v) => setTransfer({ ...transfer, to: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder={t('tx_transfer_to')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tx_transfer_to')}</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}(NT$ {Number(acc.balance).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" placeholder={t('tx_transfer_amount')} required value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} />
              <Button type="submit" className="w-full">{t('tx_confirm_transfer')}</Button>
            </form>
          ) : pickingMode ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              {actionMode === 'edit' ? t('tx_pick_edit') : t('tx_pick_delete')}
            </p>
          ) : actionMode === 'delete' && activeId ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('tx_confirm_delete_title')}</p>
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                <p>{form.type === 'income' ? t('type_income') : t('type_expense')} · {form.category || t('tx_no_category')} · NT$ {Number(form.amount).toLocaleString()}</p>
                <p>{form.occurred_at}</p>
                {form.note && <p>{form.note}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>{t('tx_confirm_delete')}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setActiveId(null); setForm(emptyForm); }}>{t('reselect')}</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              {actionMode === 'edit' && activeId && (
                <p className="text-xs font-medium text-muted-foreground">{t('tx_editing')}</p>
              )}
              <div className="flex gap-2">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, category: '' })}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{t('type_expense')}</SelectItem>
                    <SelectItem value="income">{t('type_income')}</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder={t('tx_amount')} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <Input
                type="date"
                required
                value={form.occurred_at}
                onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
              />
              <Select
                value={form.account_id || 'none'}
                onValueChange={(v) => setForm({ ...form, account_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder={t('tx_account_placeholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tx_no_account')}</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.category || 'none'}
                onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder={t('tx_category_placeholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tx_no_category')}</SelectItem>
                  {relevantCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                placeholder={t('tx_note_placeholder')}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
              <Link to="/categories" className="block text-right text-xs text-muted-foreground underline">
                {t('tx_manage_categories')}
              </Link>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{actionMode === 'edit' ? t('tx_save_edit') : t('tx_add_record')}</Button>
                {actionMode === 'edit' && activeId && (
                  <Button type="button" variant="outline" onClick={() => { setActiveId(null); setForm(emptyForm); }}>{t('reselect')}</Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : view === 'list' ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{day}</p>
              <Card>
                <div className="divide-y divide-border">
                  {items.map((tx) => {
                    const selectable = actionMode === 'edit' || actionMode === 'delete';
                    const isActive = activeId === tx.id;
                    return (
                      <div
                        key={tx.id}
                        onClick={selectable ? () => pickTransaction(tx) : undefined}
                        className={`flex items-center justify-between px-4 py-2 text-sm ${selectable ? 'cursor-pointer' : ''} ${isActive ? 'bg-muted' : selectable ? 'hover:bg-muted/50' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-xs text-muted-foreground">{accountName(tx.account_id) || t('tx_unspecified_account')}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{tx.type === 'income' ? t('type_income') : t('type_expense')}</span>
                            {tx.category && (
                              <>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">{tx.category}</span>
                              </>
                            )}
                          </div>
                          <p className="truncate">{tx.note || t('tx_no_note')}</p>
                        </div>
                        <span className={`shrink-0 pl-2 ${tx.type === 'income' ? 'text-green-600' : 'text-foreground'}`}>{tx.type === 'income' ? '+' : '-'}NT$ {Number(tx.amount).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">{t('tx_no_records')}</p>}
        </div>
      ) : (
        <CalendarView grouped={grouped} weekdays={t('cal_weekdays')} />
      )}
    </div>
  );
}

function CalendarView({ grouped, weekdays }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {weekdays.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEntries = !!grouped[dateKey];
            return (
              <div key={idx} className="flex flex-col items-center py-1 text-xs">
                <span>{day}</span>
                {hasEntries && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-foreground" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

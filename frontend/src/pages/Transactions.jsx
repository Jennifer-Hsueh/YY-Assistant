import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import LedgerSubNav from '../components/LedgerSubNav';
import Categories from './Categories';

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
const emptyTransfer = { from: '', to: '', amount: '', exchangeRate: '' };
const emptyFilters = { from: '', to: '', type: 'all', account: '', category: '', min: '', max: '', keyword: '' };

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
  const [rates, setRates] = useState({ TWD: 1 });
  // 桌機版左側顯示內容:記帳明細 / 查詢 / 管理分類
  const [panel, setPanel] = useState('list');

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
      setCategories(categories.filter((c) => c.type !== 'event'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function reloadCategories() {
    try {
      const { categories } = await api.listCategories();
      setCategories(categories.filter((c) => c.type !== 'event'));
    } catch (err) {
      console.error(err);
    }
  }

  function togglePanel(next) {
    const target = panel === next ? 'list' : next;
    if (target !== 'search') setFilters(emptyFilters);
    setPanel(target);
  }

  // 各幣別換算台幣的匯率,用來比較「當日消費最高」的那一筆
  useEffect(() => {
    const currencies = [...new Set(accounts.map((a) => a.currency || 'TWD'))].filter((c) => c !== 'TWD' && rates[c] == null);
    if (currencies.length === 0) return;
    Promise.all(
      currencies.map((c) => api.getExchangeRate(c, 'TWD').then(({ rate }) => [c, rate]).catch(() => [c, 1]))
    ).then((pairs) => setRates((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
  }, [accounts]);

  useEffect(() => {
    const fromAcc = accounts.find((a) => a.id === transfer.from);
    const toAcc = accounts.find((a) => a.id === transfer.to);
    if (fromAcc && toAcc && fromAcc.currency !== toAcc.currency) {
      api.getExchangeRate(fromAcc.currency, toAcc.currency)
        .then(({ rate }) => setTransfer((prev) => ({ ...prev, exchangeRate: String(rate) })))
        .catch((err) => console.error('[exchange rate]', err));
    }
  }, [transfer.from, transfer.to, accounts]);

  function switchActionMode(newMode) {
    setActionMode(newMode);
    if (panel === 'categories') setPanel('list');
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
    const fromAcc = accounts.find((a) => a.id === transfer.from);
    const toAcc = accounts.find((a) => a.id === transfer.to);
    const needsRate = fromAcc && toAcc && fromAcc.currency !== toAcc.currency;
    if (needsRate && (!transfer.exchangeRate || Number(transfer.exchangeRate) <= 0)) {
      setTransferError(t('tx_transfer_error_rate'));
      return;
    }
    try {
      await api.transferBetweenAccounts({
        from_account_id: transfer.from,
        to_account_id: transfer.to,
        amount: Number(transfer.amount),
        exchange_rate: needsRate ? Number(transfer.exchangeRate) : undefined,
      });
      setTransfer(emptyTransfer);
      load();
    } catch (err) {
      console.error(err);
      setTransferError(t('tx_transfer_error_fail'));
    }
  }

  const grouped = transactions.reduce((acc, t) => {
    const day = toLocalDateInput(t.occurred_at);
    (acc[day] ||= []).push(t);
    return acc;
  }, {});

  // 當日消費最高那一筆(換算台幣比較)的分類顏色;沒有分類顏色時用灰色
  function dayColor(dateKey) {
    const expenses = (grouped[dateKey] || []).filter((tx) => tx.type === 'expense');
    if (expenses.length === 0) return null;
    const toTwd = (tx) => Number(tx.amount) * (rates[accountCurrency(tx.account_id)] ?? 1);
    const top = expenses.reduce((a, b) => (toTwd(b) > toTwd(a) ? b : a));
    return categories.find((c) => c.name === top.category)?.color || '#9CA3AF';
  }

  function accountName(id) {
    return accounts.find((a) => a.id === id)?.name;
  }

  function accountCurrency(id) {
    return accounts.find((a) => a.id === id)?.currency || 'TWD';
  }

  const pickingMode = (actionMode === 'edit' || actionMode === 'delete') && !activeId;
  const relevantCategories = categories.filter((c) => c.type === form.type || c.type === 'general');

  const [filters, setFilters] = useState(emptyFilters);
  const hasFilter = Object.keys(emptyFilters).some((k) => filters[k] !== emptyFilters[k]);

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTransactions = transactions.filter((tx) => toLocalDateInput(tx.occurred_at).slice(0, 7) === currentMonthPrefix);

  // 沒有設定任何查詢條件時顯示本月;有條件時查詢全部紀錄
  const filteredTransactions = !hasFilter
    ? monthTransactions
    : transactions.filter((tx) => {
        const day = toLocalDateInput(tx.occurred_at);
        const amount = Number(tx.amount);
        if (filters.from && day < filters.from) return false;
        if (filters.to && day > filters.to) return false;
        if (filters.type !== 'all' && tx.type !== filters.type) return false;
        if (filters.account && tx.account_id !== filters.account) return false;
        if (filters.category && tx.category !== filters.category) return false;
        if (filters.min !== '' && amount < Number(filters.min)) return false;
        if (filters.max !== '' && amount > Number(filters.max)) return false;
        if (filters.keyword && !(tx.note || '').toLowerCase().includes(filters.keyword.toLowerCase())) return false;
        return true;
      });
  const filteredGrouped = filteredTransactions.reduce((acc, t) => {
    const day = toLocalDateInput(t.occurred_at);
    (acc[day] ||= []).push(t);
    return acc;
  }, {});

  const catColor = (name) => categories.find((c) => c.name === name)?.color || null;

  const searchBlock = (
    <TxSearchBlock
      t={t}
      filters={filters}
      setFilters={setFilters}
      accounts={accounts}
      categories={categories}
      hasFilter={hasFilter}
      count={filteredTransactions.length}
      onClose={panel === 'search' ? () => togglePanel('search') : null}
    />
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <div className="page-title-row mb-3 flex items-center justify-between">
        <h1 className="page-title text-lg font-semibold">{t('tx_pageTitle')}</h1>
        <div className="flex rounded-lg bg-muted p-1 text-sm">
          <button onClick={() => setView('list')} className={`rounded-md px-3 py-1 transition-colors ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{t('tx_view_list')}</button>
          <button onClick={() => setView('calendar')} className={`rounded-md px-3 py-1 transition-colors ${view === 'calendar' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{t('tx_view_calendar')}</button>
        </div>
      </div>
      <LedgerSubNav />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
      <div className="md:sticky md:top-6 md:order-2">

      <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm md:border md:border-border md:bg-card md:shadow-sm">
        <button onClick={() => switchActionMode('add')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'add' ? 'bg-card shadow-sm font-medium md:bg-muted md:shadow-none' : 'text-muted-foreground'}`}>{t('mode_add')}</button>
        <button onClick={() => switchActionMode('edit')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'edit' ? 'bg-card shadow-sm font-medium md:bg-muted md:shadow-none' : 'text-muted-foreground'}`}>{t('mode_edit')}</button>
        <button onClick={() => switchActionMode('delete')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'delete' ? 'bg-card shadow-sm font-medium md:bg-muted md:shadow-none' : 'text-muted-foreground'}`}>{t('mode_delete')}</button>
        <button onClick={() => switchActionMode('transfer')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'transfer' ? 'bg-card shadow-sm font-medium md:bg-muted md:shadow-none' : 'text-muted-foreground'}`}>{t('mode_transfer')}</button>
        <Link to="/categories" className="flex-1 rounded-md px-2 py-1.5 text-center text-muted-foreground transition-colors md:hidden">{t('tx_manage_categories')}</Link>
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
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}({acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={transfer.to || 'none'} onValueChange={(v) => setTransfer({ ...transfer, to: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder={t('tx_transfer_to')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tx_transfer_to')}</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}({acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" placeholder={t('tx_transfer_amount')} required value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} />
              {(() => {
                const fromAcc = accounts.find((a) => a.id === transfer.from);
                const toAcc = accounts.find((a) => a.id === transfer.to);
                const needsRate = fromAcc && toAcc && fromAcc.currency !== toAcc.currency;
                if (!needsRate) return null;
                const converted = transfer.amount && transfer.exchangeRate
                  ? (Number(transfer.amount) * Number(transfer.exchangeRate)).toLocaleString()
                  : null;
                return (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder={`${t('tx_exchange_rate')} (1 ${fromAcc.currency} = ? ${toAcc.currency})`}
                      value={transfer.exchangeRate}
                      onChange={(e) => setTransfer({ ...transfer, exchangeRate: e.target.value })}
                    />
                    {converted && (
                      <p className="text-xs text-muted-foreground">
                        {t('tx_exchange_preview')} {toAcc.currency} {converted}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">{t('tx_exchange_rate_hint')}</p>
                  </div>
                );
              })()}
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
                <p>{form.type === 'income' ? t('type_income') : t('type_expense')} · {form.category || t('tx_no_category')} · {accountCurrency(form.account_id)} {Number(form.amount).toLocaleString()}</p>
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
                <Input type="date" required className="flex-1" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={form.account_id || 'none'}
                  onValueChange={(v) => setForm({ ...form, account_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder={t('tx_account_placeholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('tx_no_account')}</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}({acc.currency || 'TWD'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={form.category || 'none'}
                  onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder={t('tx_category_placeholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('tx_no_category')}</SelectItem>
                    {relevantCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder={t('tx_note_placeholder')}
                  className="min-w-0 flex-[2]"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
                <Input type="number" placeholder={`${t('tx_amount')} (${accounts.find((a) => a.id === form.account_id)?.currency || 'TWD'})`} required className="min-w-0 flex-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
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

      {/* 桌機版:查詢 / 管理分類 — 點選後內容顯示在左側,取代記帳明細;再點一次收起 */}
      <div className="hidden gap-2 md:flex">
        {[
          { key: 'search', label: t('search_title') },
          { key: 'categories', label: t('tx_manage_categories') },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => togglePanel(key)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors ${panel === key ? 'border-primary bg-primary font-medium text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      </div>

      <div className="md:order-1">
      {panel === 'categories' ? (
        <div className="hidden md:block">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">{t('tx_manage_categories')}</p>
            <button type="button" onClick={() => setPanel('list')} className="text-xs text-muted-foreground underline">{t('tx_back_to_list')}</button>
          </div>
          <Categories scope="ledger" embedded onChanged={reloadCategories} />
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : view === 'list' || panel === 'search' ? (
        <div className="space-y-4">
          {/* 手機版查詢一直顯示;桌機版只有點選「查詢」時才顯示 */}
          <div className={panel === 'search' ? '' : 'md:hidden'}>{searchBlock}</div>
          {Object.entries(filteredGrouped).map(([day, items]) => (
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
                        <div className="min-w-0 flex-1 truncate">
                          {catColor(tx.category) && (
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: catColor(tx.category) }} />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {[accountName(tx.account_id) || t('tx_unspecified_account'), tx.category].filter(Boolean).join(' · ')}
                          </span>
                          <span className="text-xs text-foreground"> - {tx.note || t('tx_no_note')}</span>
                        </div>
                        <span className={`font-amount shrink-0 pl-2 flex items-baseline ${tx.type === 'income' ? 'text-green-600' : 'text-foreground'}`}>
                          <span className="inline-block w-9 text-left">{accountCurrency(tx.account_id)}</span>
                          <span className="inline-block w-16 text-right">{tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
          {filteredTransactions.length === 0 && <p className="text-sm text-muted-foreground">{t('tx_no_records')}</p>}
        </div>
      ) : (
        <CalendarView grouped={grouped} weekdays={t('cal_weekdays')} dayColor={dayColor} />
      )}
      </div>
      </div>
    </div>
  );
}

function CalendarView({ grouped, weekdays, dayColor }) {
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
            const color = dayColor(dateKey);
            return (
              <div
                key={idx}
                className="flex flex-col items-center rounded-md py-1 text-xs md:py-2"
                style={color ? { backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)` } : undefined}
              >
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

function TxSearchBlock({ t, filters, setFilters, accounts, categories, hasFilter, count, onClose }) {
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const label = 'mb-1 block text-xs text-muted-foreground';
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t('search_title')}</p>
          <div className="flex gap-3">
            {hasFilter && (
              <button type="button" onClick={() => setFilters(emptyFilters)} className="text-xs text-muted-foreground underline">
                {t('search_clear')}
              </button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} className="text-xs text-muted-foreground underline">
                {t('tx_back_to_list')}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
          <div>
            <span className={label}>{t('search_date_from')}</span>
            <Input type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} />
          </div>
          <div>
            <span className={label}>{t('search_date_to')}</span>
            <Input type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} />
          </div>
          <div>
            <span className={label}>{t('search_type')}</span>
            <Select value={filters.type} onValueChange={set('type')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('search_all_types')}</SelectItem>
                <SelectItem value="expense">{t('type_expense')}</SelectItem>
                <SelectItem value="income">{t('type_income')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={label}>{t('tx_search_by_account')}</span>
            <Select value={filters.account || 'all'} onValueChange={(v) => set('account')(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('search_all_accounts')}</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <span className={label}>{t('tx_search_by_category')}</span>
            <Select value={filters.category || 'all'} onValueChange={(v) => set('category')(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('search_all_categories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    <span className="inline-flex items-center gap-2">
                      {cat.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={label}>{t('search_amount_min')}</span>
            <Input type="number" inputMode="decimal" value={filters.min} onChange={(e) => set('min')(e.target.value)} />
          </div>
          <div>
            <span className={label}>{t('search_amount_max')}</span>
            <Input type="number" inputMode="decimal" value={filters.max} onChange={(e) => set('max')(e.target.value)} />
          </div>
          <div className="col-span-2">
            <span className={label}>{t('search_keyword')}</span>
            <Input type="text" placeholder={t('tx_search_note_placeholder')} value={filters.keyword} onChange={(e) => set('keyword')(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {hasFilter ? `${t('search_count_prefix')}${count}${t('search_count_suffix')}` : t('search_default_hint')}
        </p>
      </CardContent>
    </Card>
  );
}

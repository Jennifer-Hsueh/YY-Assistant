import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import LedgerSubNav from '../components/LedgerSubNav';

const emptyForm = { kind: 'expense', title: '', amount: '', day_of_month: '1', reminder_method: 'push', account_id: '', category: '', end_date: '' };

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Next occurrence of `day` (1–28) counting today.
function nextDateFor(day) {
  const now = new Date();
  const d = Math.min(Math.max(Number(day) || 1, 1), 28);
  let candidate = new Date(now.getFullYear(), now.getMonth(), d);
  if (ymd(candidate) < ymd(now)) candidate = new Date(now.getFullYear(), now.getMonth() + 1, d);
  return ymd(candidate);
}

function isExpired(item, today) {
  return !!item.end_date && (item.end_date < today || item.next_trigger_date > item.end_date);
}

export default function RecurringMoney() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('all');

  const [actionMode, setActionMode] = useState('add');
  const [activeId, setActiveId] = useState(null);

  const today = ymd(new Date());

  async function load() {
    setLoading(true);
    try {
      const [{ recurring_items }, { accounts }, { categories }] = await Promise.all([
        api.listRecurringItems(),
        api.listAccounts(),
        api.listCategories(),
      ]);
      setItems(recurring_items.filter((i) => i.kind === 'expense' || i.kind === 'income'));
      setAccounts(accounts);
      setCategories(categories.filter((c) => c.type !== 'event'));
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
  }

  function pickItem(item) {
    setActiveId(item.id);
    setForm({
      kind: item.kind,
      title: item.title,
      amount: item.amount != null ? String(item.amount) : '',
      day_of_month: item.day_of_month != null ? String(item.day_of_month) : '1',
      reminder_method: item.reminder_method,
      account_id: item.account_id || '',
      category: item.category || '',
      end_date: item.end_date || '',
    });
  }

  function resetAfterAction() {
    setForm(emptyForm);
    setActionMode('add');
    setActiveId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title) return;
    const payload = {
      kind: form.kind,
      title: form.title,
      amount: form.amount ? Number(form.amount) : null,
      account_id: form.account_id || null,
      category: form.category || null,
      end_date: form.end_date || null,
      frequency: 'monthly',
      day_of_month: Number(form.day_of_month),
      next_trigger_date: nextDateFor(form.day_of_month),
      reminder_method: form.reminder_method,
    };
    if (actionMode === 'edit' && activeId) {
      await api.updateRecurringItem(activeId, payload);
    } else {
      await api.createRecurringItem(payload);
    }
    resetAfterAction();
    load();
  }

  async function handleConfirmDelete() {
    await api.deleteRecurringItem(activeId);
    resetAfterAction();
    load();
  }

  async function toggleActive(item) {
    // Re-activating starts from the next upcoming date, so the paused period is not back-filled.
    const payload = item.is_active
      ? { is_active: false }
      : { is_active: true, next_trigger_date: nextDateFor(item.day_of_month) };
    await api.updateRecurringItem(item.id, payload);
    load();
  }

  const accountOf = (id) => accounts.find((a) => a.id === id);
  const pickingMode = (actionMode === 'edit' || actionMode === 'delete') && !activeId;
  const kindLabel = { expense: t('rec_kind_expense'), income: t('rec_kind_income') };
  const relevantCategories = categories.filter((c) => c.type === form.kind || c.type === 'general');

  const rank = (item) => (isExpired(item, today) ? 2 : item.is_active ? 0 : 1);
  const visibleItems = items
    .filter((item) => {
      const on = item.is_active && !isExpired(item, today);
      if (statusFilter === 'active') return on;
      if (statusFilter === 'inactive') return !on;
      return true;
    })
    .sort((a, b) => rank(a) - rank(b) || a.next_trigger_date.localeCompare(b.next_trigger_date));

  const filterButton = (value, label) => (
    <button
      type="button"
      onClick={() => setStatusFilter(value)}
      className={`flex-1 rounded-md px-3 py-1 transition-colors ${statusFilter === value ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('sub_recurring')}</h1>
      <LedgerSubNav />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
      <div>
      <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
        {filterButton('all', t('rec_filter_all'))}
        {filterButton('active', t('rec_filter_active'))}
        {filterButton('inactive', t('rec_filter_inactive'))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="mb-6 space-y-2">
          {visibleItems.map((item) => {
            const selectable = actionMode === 'edit' || actionMode === 'delete';
            const isActive = activeId === item.id;
            const expired = isExpired(item, today);
            const muted = expired || !item.is_active;
            const acc = accountOf(item.account_id);
            const details = [
              `${t('rec_monthly_prefix')}${item.day_of_month}${t('rec_monthly_suffix')}`,
              !expired && `${t('rec_next')}${item.next_trigger_date}`,
              acc?.name,
              item.category,
              item.end_date && `${t('rec_until')}${item.end_date}`,
            ].filter(Boolean).join(' · ');
            return (
              <Card
                key={item.id}
                onClick={selectable ? () => pickItem(item) : undefined}
                className={selectable ? `cursor-pointer transition-colors ${isActive ? 'bg-muted' : 'hover:bg-muted/50'}` : ''}
              >
                <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className={`min-w-0 ${muted ? 'text-muted-foreground' : ''}`}>
                    <p className="font-medium">
                      {item.title}
                      {item.amount != null && (
                        <span className={`ml-2 font-amount text-xs ${!muted && item.kind === 'income' ? 'text-green-600' : ''}`}>
                          {acc?.currency || 'TWD'} {item.kind === 'income' ? '+' : '-'}{Number(item.amount).toLocaleString()}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{details}</p>
                  </div>
                  {!selectable && (
                    expired ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{t('rec_ended')}</span>
                    ) : (
                      <Button size="sm" className="shrink-0" variant={item.is_active ? 'default' : 'secondary'} onClick={() => toggleActive(item)}>
                        {item.is_active ? t('rec_active') : t('rec_inactive')}
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })}
          {visibleItems.length === 0 && <p className="text-sm text-muted-foreground">{t('rec_no_items')}</p>}
        </div>
      )}
      </div>

      <div className="md:sticky md:top-6">
      <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
        <button onClick={() => switchActionMode('add')} className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${actionMode === 'add' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_add')}</button>
        <button onClick={() => switchActionMode('edit')} className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${actionMode === 'edit' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_edit')}</button>
        <button onClick={() => switchActionMode('delete')} className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${actionMode === 'delete' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t('mode_delete')}</button>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          {pickingMode ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              {actionMode === 'edit' ? t('rec_pick_edit') : t('rec_pick_delete')}
            </p>
          ) : actionMode === 'delete' && activeId ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('rec_confirm_delete_title')}</p>
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                <p>{kindLabel[form.kind]} · {form.title}</p>
                <p>
                  {t('rec_monthly_prefix')}{form.day_of_month}{t('rec_monthly_suffix')}
                  {form.amount && ` · ${accountOf(form.account_id)?.currency || 'TWD'} ${Number(form.amount).toLocaleString()}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>{t('tx_confirm_delete')}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              {actionMode === 'edit' && activeId && (
                <p className="text-xs font-medium text-muted-foreground">{t('rec_editing')}</p>
              )}
              <div className="flex gap-2">
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v, category: '' })}>
                  <SelectTrigger className="w-36 whitespace-nowrap"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{t('rec_kind_expense')}</SelectItem>
                    <SelectItem value="income">{t('rec_kind_income')}</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="text" placeholder={t('rec_title_placeholder')} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Input type="number" placeholder={t('rec_amount_placeholder')} className="min-w-0 flex-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <Select value={form.account_id || 'none'} onValueChange={(v) => setForm({ ...form, account_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder={t('tx_account_placeholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('tx_no_account')}</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}（{acc.currency || 'TWD'}）</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={form.category || 'none'} onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder={t('tx_category_placeholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tx_no_category')}</SelectItem>
                  {relevantCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">{t('rec_day_of_month_label')}</label>
                  <Input type="number" min="1" max="28" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">{t('rec_reminder_method_label')}</label>
                  <Select value={form.reminder_method} onValueChange={(v) => setForm({ ...form, reminder_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="push">{t('rec_reminder_push')}</SelectItem>
                      <SelectItem value="in_app">{t('rec_reminder_in_app')}</SelectItem>
                      <SelectItem value="both">{t('rec_reminder_both')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('rec_end_date')}</label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{actionMode === 'edit' ? t('tx_save_edit') : t('rec_add')}</Button>
                {actionMode === 'edit' && activeId && (
                  <Button type="button" variant="outline" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}

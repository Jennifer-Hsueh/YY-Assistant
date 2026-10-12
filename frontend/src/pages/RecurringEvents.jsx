import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import CalendarSubNav from '../components/CalendarSubNav';

const emptyForm = { title: '', day_of_month: '1', reminder_method: 'push', end_date: '' };

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

const segBtn = (on) => `flex-1 rounded-md px-3 py-1.5 transition-colors ${on ? 'bg-muted font-medium' : 'text-muted-foreground'}`;
const SEG_BAR = 'flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm';

export default function RecurringEvents() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('all');

  const [actionMode, setActionMode] = useState('add');
  const [activeId, setActiveId] = useState(null);

  const today = ymd(new Date());

  async function load() {
    setLoading(true);
    try {
      const { recurring_items } = await api.listRecurringItems();
      setItems(recurring_items.filter((i) => i.kind === 'event'));
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
      title: item.title,
      day_of_month: item.day_of_month != null ? String(item.day_of_month) : '1',
      reminder_method: item.reminder_method,
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
      kind: 'event',
      title: form.title,
      frequency: 'monthly',
      day_of_month: Number(form.day_of_month),
      next_trigger_date: nextDateFor(form.day_of_month),
      reminder_method: form.reminder_method,
      end_date: form.end_date || null,
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
    // 重新啟用時從下一個日期開始,不補發停用期間的提醒
    const payload = item.is_active
      ? { is_active: false }
      : { is_active: true, next_trigger_date: nextDateFor(item.day_of_month) };
    await api.updateRecurringItem(item.id, payload);
    load();
  }

  const pickingMode = (actionMode === 'edit' || actionMode === 'delete') && !activeId;

  const rank = (item) => (isExpired(item, today) ? 2 : item.is_active ? 0 : 1);
  const visibleItems = items
    .filter((item) => {
      const on = item.is_active && !isExpired(item, today);
      if (statusFilter === 'active') return on;
      if (statusFilter === 'inactive') return !on;
      return true;
    })
    .sort((a, b) => rank(a) - rank(b) || a.next_trigger_date.localeCompare(b.next_trigger_date));

  const filterButtons = [['all', 'rec_filter_all'], ['active', 'rec_filter_active'], ['inactive', 'rec_filter_inactive']].map(([v, k]) => (
    <button key={v} type="button" onClick={() => setStatusFilter(v)} className={segBtn(statusFilter === v)}>{t(k)}</button>
  ));
  const modeButtons = [['add', 'mode_add'], ['edit', 'mode_edit'], ['delete', 'mode_delete']].map(([m, k]) => (
    <button key={m} type="button" onClick={() => switchActionMode(m)} className={segBtn(actionMode === m)}>{t(k)}</button>
  ));

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-calendar)', '--ring': 'var(--module-calendar)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('sub_recurring_events')}</h1>
      <CalendarSubNav />

      {/* 手機版:篩選與新增/編輯/刪除放在同一個區塊 */}
      <div className="mb-3 rounded-lg border border-border bg-card p-1 text-sm shadow-sm md:hidden">
        <div className="flex">{filterButtons}</div>
        <div className="my-1 border-t border-border" />
        <div className="flex">{modeButtons}</div>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
      <div className="order-2 md:order-none">
      <div className={`mb-3 hidden md:flex ${SEG_BAR}`}>{filterButtons}</div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="mb-6 space-y-2">
          {visibleItems.map((item) => {
            const selectable = actionMode === 'edit' || actionMode === 'delete';
            const isActive = activeId === item.id;
            const expired = isExpired(item, today);
            const muted = expired || !item.is_active;
            const details = [
              `${t('rec_monthly_prefix')}${item.day_of_month}${t('rec_monthly_suffix')}`,
              !expired && `${t('rec_next')}${item.next_trigger_date}`,
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
                    <p className="font-medium">{item.title}</p>
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

      <div className="order-1 mb-4 md:order-none md:mb-0 md:sticky md:top-6">
      <div className={`mb-3 hidden md:flex ${SEG_BAR}`}>{modeButtons}</div>

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
                <p>{form.title}</p>
                <p>{t('rec_monthly_prefix')}{form.day_of_month}{t('rec_monthly_suffix')}</p>
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
              <Input type="text" placeholder={t('rec_title_placeholder')} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="flex gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">{t('rec_day_of_month_label')}</label>
                  <Input type="number" min="1" max="28" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
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

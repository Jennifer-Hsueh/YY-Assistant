import { useEffect, useState } from 'react';
import RecurrenceFields from '../components/RecurrenceFields';
import { emptyRecurrence, recurrenceFromItem, recurrencePayload, reactivationPayload, describeRecurrence } from '../lib/recurrence';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import CalendarSubNav from '../components/CalendarSubNav';

const emptyForm = { title: '', ...emptyRecurrence, reminder_method: 'push', end_date: '' };

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 重新啟用時預設的起始日期:依原本的頻率算出下一次
const nextOccurrenceFor = (item) => nextOccurrenceSafe(recurrenceFromItem(item));
function nextOccurrenceSafe(r) { return recurrencePayload(r).next_trigger_date; }

const isDesktopNow = () => window.matchMedia('(min-width: 768px)').matches;

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
  // 手機版:全部/啟用中/停用中/新增/編輯/刪除 六選一('filter' = 看列表,'mode' = 操作表單)
  const [mobileView, setMobileView] = useState('filter');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 重新啟用:要先選新的起始日期
  const [reactivateId, setReactivateId] = useState(null);
  const [reactivateDate, setReactivateDate] = useState('');

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
    setConfirmDelete(false);
    setForm({
      title: item.title,
      ...recurrenceFromItem(item),
      reminder_method: item.reminder_method,
      end_date: item.end_date || '',
    });
  }

  function resetAfterAction() {
    setConfirmDelete(false);
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
      ...recurrencePayload(form),
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
    if (item.is_active && !isExpired(item, today)) {
      await api.updateRecurringItem(item.id, { is_active: false });
      load();
      return;
    }
    // 停用中/已結束 → 重新啟用前先選新的起始日期
    setReactivateId(item.id);
    setReactivateDate(nextOccurrenceFor(item));
  }

  async function confirmReactivate(item) {
    if (!reactivateDate) return;
    await api.updateRecurringItem(item.id, {
      ...reactivationPayload(item, reactivateDate),
      // 結束日已過或早於新的起始日 → 清掉,讓循環重新開始
      ...(item.end_date && item.end_date < reactivateDate ? { end_date: null } : {}),
    });
    setReactivateId(null);
    load();
  }

  const pickingMode = (actionMode === 'edit' || actionMode === 'delete') && !activeId;

  const rank = (item) => (isExpired(item, today) ? 2 : item.is_active ? 0 : 1);
  const onlyActive = mobileView === 'mode' && (actionMode === 'add' || actionMode === 'edit');
  const visibleItems = items
    .filter((item) => {
      const on = item.is_active && !isExpired(item, today);
      if (onlyActive && !isDesktopNow()) return on;
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

      {/* 手機版:篩選與新增/編輯/刪除放在同一個區塊,一次只選一個 */}
      <div className="mb-3 rounded-lg border border-border bg-card p-1 text-sm shadow-sm md:hidden">
        <div className="flex">
          {[['all', 'rec_filter_all'], ['active', 'rec_filter_active'], ['inactive', 'rec_filter_inactive']].map(([v, k]) => (
            <button
              key={v}
              type="button"
              onClick={() => { setStatusFilter(v); setMobileView('filter'); switchActionMode('add'); }}
              className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${mobileView === 'filter' && statusFilter === v ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
            >{t(k)}</button>
          ))}
        </div>
        <div className="my-1 border-t border-border" />
        <div className="flex">
          {[['add', 'mode_add'], ['edit', 'mode_edit'], ['delete', 'mode_delete']].map(([m, k]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setStatusFilter('all'); setMobileView('mode'); switchActionMode(m); }}
              className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${mobileView === 'mode' && actionMode === m ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
            >{t(k)}</button>
          ))}
        </div>
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
              describeRecurrence(item, t),
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
                  {!selectable && reactivateId !== item.id && (
                    <Button size="sm" className="shrink-0" variant={item.is_active && !expired ? 'default' : 'secondary'} onClick={() => toggleActive(item)}>
                      {expired ? t('rec_ended') : item.is_active ? t('rec_active') : t('rec_inactive')}
                    </Button>
                  )}
                </CardContent>
                {reactivateId === item.id && (
                  <div className="space-y-2 border-t border-border px-3 pb-3 pt-2 text-sm">
                    <label className="text-xs text-muted-foreground">{t('rec_reactivate_date')}</label>
                    <div className="flex gap-2">
                      <Input type="date" value={reactivateDate} min={today} onChange={(e) => setReactivateDate(e.target.value)} className="min-w-0 flex-1" />
                      <Button size="sm" onClick={() => confirmReactivate(item)} disabled={!reactivateDate}>{t('rec_reactivate')}</Button>
                      <Button size="sm" variant="outline" onClick={() => setReactivateId(null)}>{t('cancel')}</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          {visibleItems.length === 0 && <p className="text-sm text-muted-foreground">{t('rec_no_items')}</p>}
        </div>
      )}
      </div>

      <div className={`order-1 mb-4 md:order-none md:mb-0 md:block md:sticky md:top-6 ${mobileView === 'filter' ? 'hidden' : ''}`}>
      <div className={`mb-3 hidden md:flex ${SEG_BAR}`}>{modeButtons}</div>

      {pickingMode && (
        <p className="px-1 text-sm text-muted-foreground">{actionMode === 'edit' ? t('rec_pick_edit') : t('rec_pick_delete')}</p>
      )}
      <Card className={pickingMode ? 'hidden' : ''}>
        <CardContent className="space-y-2 p-4">
          {actionMode === 'delete' && activeId ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('rec_confirm_delete_title')}</p>
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                <p>{form.title}</p>
                <p>{describeRecurrence({ ...form, ...recurrencePayload(form) }, t)}</p>
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
              <RecurrenceFields form={form} setForm={setForm} t={t} />
              <div className="flex gap-2">
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
              {actionMode === 'edit' && activeId ? (
                confirmDelete ? (
                  <div className="space-y-2 rounded-md border border-border p-2">
                    <p className="text-sm">{t('rec_confirm_delete_title')}</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>{t('tx_confirm_delete')}</Button>
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>{t('cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">{t('tx_save_edit')}</Button>
                    <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>{t('mode_delete')}</Button>
                    <Button type="button" variant="outline" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
                  </div>
                )
              ) : (
                <Button type="submit" className="w-full">{t('rec_add')}</Button>
              )}
            </form>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}

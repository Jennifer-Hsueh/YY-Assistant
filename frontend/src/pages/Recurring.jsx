import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { requestPushToken } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

const emptyForm = { kind: 'expense', title: '', amount: '', frequency: 'monthly', day_of_month: '1', reminder_method: 'push' };

export default function Recurring() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState('idle');
  const [form, setForm] = useState(emptyForm);

  // actionMode: 'add' | 'edit' | 'delete'
  const [actionMode, setActionMode] = useState('add');
  const [activeId, setActiveId] = useState(null);

  async function handleEnablePush() {
    setPushStatus('enabling');
    const token = await requestPushToken();
    if (!token) { setPushStatus('failed'); return; }
    try {
      await api.registerPushSubscription(token);
      setPushStatus('enabled');
    } catch (err) {
      console.error(err);
      setPushStatus('failed');
    }
  }

  async function load() {
    setLoading(true);
    try {
      const { recurring_items } = await api.listRecurringItems();
      setItems(recurring_items);
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
      frequency: item.frequency,
      day_of_month: item.day_of_month != null ? String(item.day_of_month) : '1',
      reminder_method: item.reminder_method,
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

    if (actionMode === 'edit' && activeId) {
      await api.updateRecurringItem(activeId, {
        kind: form.kind,
        title: form.title,
        amount: form.amount ? Number(form.amount) : null,
        frequency: form.frequency,
        day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
        reminder_method: form.reminder_method,
      });
    } else {
      const now = new Date();
      const nextDate = new Date(now.getFullYear(), now.getMonth(), Number(form.day_of_month) || 1);
      if (nextDate < now) nextDate.setMonth(nextDate.getMonth() + 1);
      await api.createRecurringItem({
        kind: form.kind, title: form.title, amount: form.amount ? Number(form.amount) : null,
        frequency: form.frequency, day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
        next_trigger_date: nextDate.toISOString().slice(0, 10), reminder_method: form.reminder_method,
      });
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
    await api.updateRecurringItem(item.id, { is_active: !item.is_active });
    load();
  }

  const pickingMode = (actionMode === 'edit' || actionMode === 'delete') && !activeId;
  const kindLabel = { expense: '循環支出', income: '循環收入', event: '循環行程' };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <h1 className="mb-4 text-lg font-semibold">循環記帳/行程提醒</h1>
      <Card className="mb-4">
        <CardContent className="p-3 text-sm">
          {pushStatus === 'enabled' ? (
            <p className="text-green-600">✓ 推播通知已啟用</p>
          ) : (
            <Button size="sm" onClick={handleEnablePush} disabled={pushStatus === 'enabling'}>
              {pushStatus === 'enabling' ? '設定中…' : '啟用推播通知'}
            </Button>
          )}
          {pushStatus === 'failed' && <p className="mt-1 text-xs text-destructive">未能啟用推播(可能是瀏覽器拒絕通知權限,或尚未設定 Firebase)</p>}
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">載入中…</p>
      ) : (
        <div className="mb-6 space-y-2">
          {items.map((item) => {
            const selectable = actionMode === 'edit' || actionMode === 'delete';
            const isActive = activeId === item.id;
            return (
              <Card
                key={item.id}
                onClick={selectable ? () => pickItem(item) : undefined}
                className={selectable ? `cursor-pointer transition-colors ${isActive ? 'bg-muted' : 'hover:bg-muted/50'}` : ''}
              >
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.frequency === 'monthly' ? `每月 ${item.day_of_month} 號` : '每週'} · 下次:{item.next_trigger_date}</p>
                  </div>
                  {!selectable && (
                    <Button size="sm" variant={item.is_active ? 'default' : 'secondary'} onClick={() => toggleActive(item)}>
                      {item.is_active ? '啟用中' : '已停用'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {items.length === 0 && <p className="text-sm text-muted-foreground">還沒有循環項目</p>}
        </div>
      )}

      {/* Action mode switch: 新增 / 編輯 / 刪除 */}
      <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
        <button
          onClick={() => switchActionMode('add')}
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${actionMode === 'add' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
        >新增</button>
        <button
          onClick={() => switchActionMode('edit')}
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${actionMode === 'edit' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
        >編輯</button>
        <button
          onClick={() => switchActionMode('delete')}
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${actionMode === 'delete' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
        >刪除</button>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          {pickingMode ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              請從上方列表點選要{actionMode === 'edit' ? '編輯' : '刪除'}的項目
            </p>
          ) : actionMode === 'delete' && activeId ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">確定要刪除這個循環項目嗎?</p>
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                <p>{kindLabel[form.kind]} · {form.title}</p>
                <p>每月 {form.day_of_month} 號{form.amount && ` · NT$ ${Number(form.amount).toLocaleString()}`}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>確認刪除</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setActiveId(null)}>重新選擇</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              {actionMode === 'edit' && activeId && (
                <p className="text-xs font-medium text-muted-foreground">正在編輯這個循環項目</p>
              )}
              <div className="flex gap-2">
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">循環支出</SelectItem>
                    <SelectItem value="income">循環收入</SelectItem>
                    <SelectItem value="event">循環行程</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="text" placeholder="項目名稱" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              {form.kind !== 'event' && (
                <Input type="number" placeholder="金額(選填)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              )}
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">每月第幾天</label>
                  <Input type="number" min="1" max="28" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">提醒方式</label>
                  <Select value={form.reminder_method} onValueChange={(v) => setForm({ ...form, reminder_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="push">推播通知</SelectItem>
                      <SelectItem value="in_app">僅 APP 內顯示</SelectItem>
                      <SelectItem value="both">兩者皆要</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{actionMode === 'edit' ? '儲存修改' : '新增循環項目'}</Button>
                {actionMode === 'edit' && activeId && (
                  <Button type="button" variant="outline" onClick={() => setActiveId(null)}>重新選擇</Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

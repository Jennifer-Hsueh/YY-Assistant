import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { requestPushToken } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

export default function Recurring() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState('idle');
  const [form, setForm] = useState({ kind: 'expense', title: '', amount: '', frequency: 'monthly', day_of_month: '1', reminder_method: 'push' });

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

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title) return;
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), Number(form.day_of_month) || 1);
    if (nextDate < now) nextDate.setMonth(nextDate.getMonth() + 1);
    await api.createRecurringItem({
      kind: form.kind, title: form.title, amount: form.amount ? Number(form.amount) : null,
      frequency: form.frequency, day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
      next_trigger_date: nextDate.toISOString().slice(0, 10), reminder_method: form.reminder_method,
    });
    setForm({ ...form, title: '', amount: '' });
    load();
  }

  async function toggleActive(item) {
    await api.updateRecurringItem(item.id, { is_active: !item.is_active });
    load();
  }

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
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.frequency === 'monthly' ? `每月 ${item.day_of_month} 號` : '每週'} · 下次:{item.next_trigger_date}</p>
                </div>
                <Button size="sm" variant={item.is_active ? 'default' : 'secondary'} onClick={() => toggleActive(item)}>
                  {item.is_active ? '啟用中' : '已停用'}
                </Button>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">還沒有循環項目</p>}
        </div>
      )}
      <Card>
        <CardContent className="space-y-2 p-4">
          <form onSubmit={handleAdd} className="space-y-2">
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
            <Button type="submit" className="w-full">新增循環項目</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

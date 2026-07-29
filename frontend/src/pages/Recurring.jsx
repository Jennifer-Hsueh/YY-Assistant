import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { requestPushToken } from '../lib/firebase';

// Standalone management page listing all recurring items, with
// user-configurable reminder method — per the planning doc.
export default function Recurring() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState('idle'); // 'idle' | 'enabling' | 'enabled' | 'failed'
  const [form, setForm] = useState({
    kind: 'expense',
    title: '',
    amount: '',
    frequency: 'monthly',
    day_of_month: '1',
    reminder_method: 'push',
  });

  async function handleEnablePush() {
    setPushStatus('enabling');
    const token = await requestPushToken();
    if (!token) {
      setPushStatus('failed');
      return;
    }
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

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title) return;
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), Number(form.day_of_month) || 1);
    if (nextDate < now) nextDate.setMonth(nextDate.getMonth() + 1);

    await api.createRecurringItem({
      kind: form.kind,
      title: form.title,
      amount: form.amount ? Number(form.amount) : null,
      frequency: form.frequency,
      day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
      next_trigger_date: nextDate.toISOString().slice(0, 10),
      reminder_method: form.reminder_method,
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

      <div className="mb-4 rounded-xl bg-white p-3 shadow-sm text-sm">
        {pushStatus === 'enabled' ? (
          <p className="text-green-600">✓ 推播通知已啟用</p>
        ) : (
          <button
            onClick={handleEnablePush}
            disabled={pushStatus === 'enabling'}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-white disabled:opacity-50"
          >
            {pushStatus === 'enabling' ? '設定中…' : '啟用推播通知'}
          </button>
        )}
        {pushStatus === 'failed' && (
          <p className="mt-1 text-xs text-red-500">
            未能啟用推播(可能是瀏覽器拒絕通知權限,或尚未設定 Firebase)
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : (
        <div className="mb-6 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm text-sm">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-gray-400">
                  {item.frequency === 'monthly' ? `每月 ${item.day_of_month} 號` : '每週'} · 下次:{item.next_trigger_date}
                </p>
              </div>
              <button
                onClick={() => toggleActive(item)}
                className={`rounded-full px-3 py-1 text-xs ${
                  item.is_active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {item.is_active ? '啟用中' : '已停用'}
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400">還沒有循環項目</p>}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="expense">循環支出</option>
            <option value="income">循環收入</option>
            <option value="event">循環行程</option>
          </select>
          <input
            type="text"
            placeholder="項目名稱"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        {form.kind !== 'event' && (
          <input
            type="number"
            placeholder="金額(選填)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        )}
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-gray-500">
            每月第幾天
            <input
              type="number"
              min="1"
              max="28"
              value={form.day_of_month}
              onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex-1 text-xs text-gray-500">
            提醒方式
            <select
              value={form.reminder_method}
              onChange={(e) => setForm({ ...form, reminder_method: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="push">推播通知</option>
              <option value="in_app">僅 APP 內顯示</option>
              <option value="both">兩者皆要</option>
            </select>
          </label>
        </div>
        <button type="submit" className="w-full rounded-md bg-gray-900 py-2 text-sm text-white">
          新增循環項目
        </button>
      </form>
    </div>
  );
}

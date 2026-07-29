import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Bookkeeping page: list view (grouped by date) + calendar view toggle,
// per the planning doc's decision for this module.
export default function Transactions() {
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'expense', amount: '', category: '', note: '' });

  async function load() {
    setLoading(true);
    try {
      const { transactions } = await api.listTransactions();
      setTransactions(transactions);
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
    if (!form.amount) return;
    await api.createTransaction({
      type: form.type,
      amount: Number(form.amount),
      category: form.category || null,
      note: form.note || null,
      occurred_at: new Date().toISOString(),
    });
    setForm({ type: 'expense', amount: '', category: '', note: '' });
    load();
  }

  const grouped = transactions.reduce((acc, t) => {
    const day = t.occurred_at.slice(0, 10);
    (acc[day] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">記帳</h1>
        <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setView('list')}
            className={`rounded-md px-3 py-1 ${view === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            列表
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`rounded-md px-3 py-1 ${view === 'calendar' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            日曆
          </button>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mb-6 space-y-2 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <input
            type="number"
            placeholder="金額"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <input
          type="text"
          placeholder="分類(選填)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button type="submit" className="w-full rounded-md bg-gray-900 py-2 text-sm text-white">
          新增紀錄
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : view === 'list' ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <p className="mb-1 text-xs font-medium text-gray-400">{day}</p>
              <div className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>{t.category || (t.type === 'income' ? '收入' : '支出')}</span>
                    <span className={t.type === 'income' ? 'text-green-600' : 'text-gray-900'}>
                      {t.type === 'income' ? '+' : '-'}NT$ {Number(t.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-gray-400">還沒有任何紀錄</p>}
        </div>
      ) : (
        <CalendarView grouped={grouped} />
      )}
    </div>
  );
}

// Minimal month-grid calendar view — shows a dot per day with a
// transaction, matching the planning doc's "日曆式" requirement.
// Iterate on this once the design direction (色系/樣式) is finalized.
function CalendarView({ grouped }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasEntries = !!grouped[dateKey];
          return (
            <div key={idx} className="flex flex-col items-center py-1 text-xs">
              <span>{day}</span>
              {hasEntries && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-gray-900" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Dashboard overview: key summaries from each module (this month's
// spending, today's schedule) — per the planning doc's home-page decision.
export default function Dashboard() {
  const [monthSpending, setMonthSpending] = useState(null);
  const [todayEvents, setTodayEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      try {
        const [{ transactions }, { events }] = await Promise.all([
          api.listTransactions({ from: monthStart, type: 'expense' }),
          api.listEvents({ from: todayStart, to: todayEnd }),
        ]);
        const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        setMonthSpending(total);
        setTodayEvents(events);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <h1 className="mb-4 text-lg font-semibold">儀表板</h1>

      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">本月支出</p>
        <p className="mt-1 text-2xl font-semibold">
          {loading ? '…' : `NT$ ${monthSpending?.toLocaleString() ?? 0}`}
        </p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm text-gray-500">今日行程</p>
        {loading ? (
          <p className="text-sm text-gray-400">載入中…</p>
        ) : todayEvents.length === 0 ? (
          <p className="text-sm text-gray-400">今天沒有安排的行程</p>
        ) : (
          <ul className="space-y-2">
            {todayEvents.map((ev) => (
              <li key={ev.id} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ev.color || '#9CA3AF' }}
                />
                {ev.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

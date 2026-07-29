import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Month view as the primary calendar presentation, per the planning doc.
// Category color + label shown on each event chip; a small icon marks
// source (app vs google) once phase-2 sync exists.
export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', date: '', category: '', color: '#4F46E5' });

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  async function load() {
    setLoading(true);
    try {
      const monthStart = new Date(year, month, 1).toISOString();
      const monthEnd = new Date(year, month + 1, 1).toISOString();
      const { events } = await api.listEvents({ from: monthStart, to: monthEnd });
      setEvents(events);
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
    if (!form.title || !form.date) return;
    await api.createEvent({
      title: form.title,
      start_at: new Date(form.date).toISOString(),
      category: form.category || null,
      color: form.color,
    });
    setForm({ title: '', date: '', category: '', color: '#4F46E5' });
    load();
  }

  const eventsByDay = events.reduce((acc, ev) => {
    const day = ev.start_at.slice(0, 10);
    (acc[day] ||= []).push(ev);
    return acc;
  }, {});

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32">
      <h1 className="mb-4 text-lg font-semibold">
        行事曆 — {year}年{month + 1}月
      </h1>

      <div className="mb-6 rounded-xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = eventsByDay[dateKey] || [];
            return (
              <div key={idx} className="flex min-h-14 flex-col items-center gap-0.5 rounded-md py-1 text-xs">
                <span>{day}</span>
                {dayEvents.slice(0, 2).map((ev) => (
                  <span
                    key={ev.id}
                    title={ev.title}
                    className="w-full truncate rounded px-1 text-[10px] text-white"
                    style={{ backgroundColor: ev.color || '#9CA3AF' }}
                  >
                    {ev.source === 'google' ? '📅' : ''}
                    {ev.title}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="事件標題"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="h-9 w-12 rounded-md border border-gray-300"
          />
        </div>
        <input
          type="text"
          placeholder="分類(選填,如:工作/個人)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button type="submit" className="w-full rounded-md bg-gray-900 py-2 text-sm text-white">
          新增事件
        </button>
      </form>

      {loading && <p className="mt-4 text-sm text-gray-400">載入中…</p>}
    </div>
  );
}

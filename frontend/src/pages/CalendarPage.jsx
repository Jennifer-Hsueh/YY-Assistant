import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import DateInputSegmented from '../components/DateInputSegmented';

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

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title || !form.date) return;
    await api.createEvent({ title: form.title, start_at: new Date(form.date).toISOString(), category: form.category || null, color: form.color });
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
      <h1 className="mb-4 text-lg font-semibold">行事曆 — {year}年{month + 1}月</h1>
      <Card className="mb-6">
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => <div key={d}>{d}</div>)}
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
                    <span key={ev.id} title={ev.title} className="w-full truncate rounded px-1 text-[10px] text-white" style={{ backgroundColor: ev.color || '#9CA3AF' }}>
                      {ev.source === 'google' ? '📅' : ''}{ev.title}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-4">
          <form onSubmit={handleAdd} className="space-y-2">
            <Input type="text" placeholder="事件標題" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="flex gap-2">
              <DateInputSegmented value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-12 rounded-md border border-input" />
            </div>
            <Input type="text" placeholder="分類(選填,如:工作/個人)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Button type="submit" className="w-full">新增事件</Button>
          </form>
        </CardContent>
      </Card>
      {loading && <p className="mt-4 text-sm text-muted-foreground">載入中…</p>}
    </div>
  );
}

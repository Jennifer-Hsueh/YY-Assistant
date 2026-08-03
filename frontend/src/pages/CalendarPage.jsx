import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import DateInputSegmented from '../components/DateInputSegmented';

const emptyForm = { title: '', date: '', category: '', color: '#4F46E5' };

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // actionMode: 'add' | 'edit' | 'delete'
  const [actionMode, setActionMode] = useState('add');
  const [activeId, setActiveId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // dateKey string, e.g. '2026-08-01'

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

  function switchActionMode(newMode) {
    setActionMode(newMode);
    setActiveId(null);
    setForm({ ...emptyForm, date: selectedDay || '' });
  }

  function toDateInputValue(isoString) {
    return isoString.slice(0, 10);
  }

  function pickEvent(ev) {
    setActiveId(ev.id);
    setForm({
      title: ev.title,
      date: toDateInputValue(ev.start_at),
      category: ev.category || '',
      color: ev.color || '#4F46E5',
    });
  }

  function resetAfterAction() {
    setForm({ ...emptyForm, date: selectedDay || '' });
    setActiveId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.date) return;
    const payload = {
      title: form.title,
      start_at: new Date(form.date).toISOString(),
      category: form.category || null,
      color: form.color,
    };
    if (actionMode === 'edit' && activeId) {
      await api.updateEvent(activeId, payload);
    } else {
      await api.createEvent(payload);
    }
    resetAfterAction();
    load();
  }

  async function handleConfirmDelete() {
    await api.deleteEvent(activeId);
    resetAfterAction();
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

  function handleDayClick(dateKey) {
    setSelectedDay((prev) => (prev === dateKey ? null : dateKey));
    setActiveId(null);
    setForm({ ...emptyForm, date: dateKey });
  }

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32" style={{ '--primary': 'var(--module-calendar)', '--ring': 'var(--module-calendar)' }}>
      <h1 className="mb-4 text-lg font-semibold">行事曆 — {year}年{month + 1}月</h1>

      <Card className="mb-3">
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDay[dateKey] || [];
              const isSelected = selectedDay === dateKey;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleDayClick(dateKey)}
                  className={`flex min-h-14 flex-col items-center gap-0.5 rounded-md py-1 text-xs ${isSelected ? 'bg-muted ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                >
                  <span>{day}</span>
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span key={ev.id} title={ev.title} className="w-full truncate rounded px-1 text-[10px] text-white" style={{ backgroundColor: ev.color || '#9CA3AF' }}>
                      {ev.source === 'google' ? '📅' : ''}{ev.title}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!selectedDay ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            請先在上方月曆點選一個日期
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{selectedDay} 的行程</p>
              <div className="flex rounded-lg bg-muted p-1 text-xs">
                <button
                  onClick={() => switchActionMode('add')}
                  className={`rounded-md px-2 py-1 transition-colors ${actionMode === 'add' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
                >新增</button>
                <button
                  onClick={() => switchActionMode('edit')}
                  className={`rounded-md px-2 py-1 transition-colors ${actionMode === 'edit' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
                >編輯</button>
                <button
                  onClick={() => switchActionMode('delete')}
                  className={`rounded-md px-2 py-1 transition-colors ${actionMode === 'delete' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
                >刪除</button>
              </div>
            </div>

            {actionMode === 'add' && (
              <form onSubmit={handleSubmit} className="space-y-2">
                <Input type="text" placeholder="事件標題" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <div className="flex gap-2">
                  <DateInputSegmented value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-12 rounded-md border border-input" />
                </div>
                <Input type="text" placeholder="分類(選填,如:工作/個人)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <Button type="submit" className="w-full">新增事件</Button>
              </form>
            )}

            {actionMode === 'edit' && !activeId && (
              <div className="space-y-1">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">這天沒有任何行程</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">請點選要編輯的行程</p>
                    {selectedDayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => pickEvent(ev)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ev.color || '#9CA3AF' }} />
                        <span>{ev.title}</span>
                        {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {actionMode === 'edit' && activeId && (
              <form onSubmit={handleSubmit} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">正在編輯這筆行程</p>
                <Input type="text" placeholder="事件標題" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <div className="flex gap-2">
                  <DateInputSegmented value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-12 rounded-md border border-input" />
                </div>
                <Input type="text" placeholder="分類(選填,如:工作/個人)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">儲存修改</Button>
                  <Button type="button" variant="outline" onClick={() => setActiveId(null)}>重新選擇</Button>
                </div>
              </form>
            )}

            {actionMode === 'delete' && !activeId && (
              <div className="space-y-1">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">這天沒有任何行程</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">請點選要刪除的行程</p>
                    {selectedDayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => pickEvent(ev)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ev.color || '#9CA3AF' }} />
                        <span>{ev.title}</span>
                        {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {actionMode === 'delete' && activeId && (
              <div className="space-y-2">
                <p className="text-sm font-medium">確定要刪除這筆行程嗎?</p>
                <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                  <p>{form.title}</p>
                  <p>{form.date} {form.category && `· ${form.category}`}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>確認刪除</Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setActiveId(null)}>重新選擇</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading && <p className="mt-4 text-sm text-muted-foreground">載入中…</p>}
    </div>
  );
}

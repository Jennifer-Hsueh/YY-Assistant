import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import DateInputSegmented from '../components/DateInputSegmented';
import CalendarSubNav from '../components/CalendarSubNav';
import Categories from './Categories';

function pastelForDate(dateKey) {
  // 顏色定義在 index.css(--pastel-1~6),石墨灰主題會自動換成灰階
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) hash = (hash * 31 + dateKey.charCodeAt(i)) % 6;
  return `var(--pastel-${(Math.abs(hash) % 6) + 1})`;
}

const emptyFilters = { from: '', to: '', category: '', keyword: '' };

const emptyForm = { title: '', date: '', time: '', note: '', category: '', color: '#4F46E5' };

export default function CalendarPage() {
  const { t } = useLanguage();
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const [actionMode, setActionMode] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const monthStart = new Date(year, month, 1).toISOString();
      const monthEnd = new Date(year, month + 1, 1).toISOString();
      const [{ events }, { categories }] = await Promise.all([
        api.listEvents({ from: monthStart, to: monthEnd }),
        api.listCategories(),
      ]);
      setEvents(events);
      setCategories(categories.filter((c) => c.type === 'event'));
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

  function toTimeInputValue(isoString) {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function pickEvent(ev) {
    setActiveId(ev.id);
    setForm({
      title: ev.title,
      date: toDateInputValue(ev.start_at),
      time: toTimeInputValue(ev.start_at),
      note: ev.note || '',
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
    const startAt = form.time ? `${form.date}T${form.time}:00` : `${form.date}T00:00:00`;
    const payload = {
      title: form.title,
      start_at: new Date(startAt).toISOString(),
      category: form.category || null,
      color: form.category ? categoryColor(form.category) : '#9CA3AF',
      note: form.note || null,
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
  const weekdays = t('cal_weekdays');
  const categoryColor = (name) => categories.find((c) => c.name === name)?.color || '#9CA3AF';
  const eventColor = (ev) => (ev.category ? categoryColor(ev.category) : '#9CA3AF');

  const [filters, setFilters] = useState(emptyFilters);
  // 桌機版:查詢 / 管理分類 點選後才展開
  const [panel, setPanel] = useState(null);
  function togglePanel(next) {
    const target = panel === next ? null : next;
    if (target !== 'search') setFilters(emptyFilters);
    setPanel(target);
  }
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const hasFilter = Object.keys(emptyFilters).some((k) => filters[k] !== emptyFilters[k]);
  const setFilter = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!hasFilter) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { events: allEvents } = await api.listEvents({});
        const kw = filters.keyword.trim().toLowerCase();
        const localDay = (iso) => {
          const d = new Date(iso);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const matched = allEvents
          .filter((ev) => {
            const day = localDay(ev.start_at);
            if (filters.from && day < filters.from) return false;
            if (filters.to && day > filters.to) return false;
            if (filters.category && (ev.category || '') !== filters.category) return false;
            if (kw && !`${ev.title} ${ev.note || ''}`.toLowerCase().includes(kw)) return false;
            return true;
          })
          .sort((a, b) => a.start_at.localeCompare(b.start_at));
        setSearchResults(matched);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-calendar)', '--ring': 'var(--module-calendar)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('cal_pageTitle')} — {year}-{String(month + 1).padStart(2, '0')}</h1>
      <CalendarSubNav />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:grid-rows-[auto_1fr] md:items-start md:gap-x-6">
      <div className="md:col-start-2 md:row-start-1">

      {/* Action mode switch: 新增 / 編輯 / 刪除 / 管理分類 — 跟記帳頁一致,放在標題下方 */}
      <div className="mb-3 flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
        <button
          onClick={() => switchActionMode('add')}
          className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'add' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
        >{t('mode_add')}</button>
        <button
          onClick={() => switchActionMode('edit')}
          className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'edit' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
        >{t('mode_edit')}</button>
        <button
          onClick={() => switchActionMode('delete')}
          className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'delete' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
        >{t('mode_delete')}</button>
      </div>

      </div>

      <div className="md:col-start-1 md:row-span-2 md:row-start-1">
      <Card className="mb-3">
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {weekdays.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDay[dateKey] || [];
              const isSelected = selectedDay === dateKey;
              const hasEvents = dayEvents.length > 0;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleDayClick(dateKey)}
                  className={`flex min-h-14 flex-col md:min-h-20 items-center gap-0.5 rounded-md py-1 text-xs ${isSelected ? 'ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                  style={hasEvents ? { backgroundColor: pastelForDate(dateKey) } : undefined}
                >
                  <span>{day}</span>
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span key={ev.id} title={ev.title} className="flex w-full items-center gap-1 truncate px-1 text-xs text-black">
                      <span className="ml-0.5 h-[7.2px] w-[7.2px] shrink-0 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                      <span className="truncate pl-0.5">{ev.source === 'google' ? '📅' : ''}{ev.title}</span>
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </div>

      <div className="md:col-start-2 md:row-start-2">
      {/* 未選擇任何模式:點日期只顯示當日行程,沒點日期就空白 */}
      {!actionMode && selectedDay && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">{selectedDay}{t('cal_events_of_day_suffix')}</p>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('cal_no_events_this_day')}</p>
            ) : (
              <div className="space-y-1">
                {selectedDayEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                    <span>{ev.title}</span>
                    {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 選了新增模式:直接顯示新增表單 */}
      {actionMode === 'add' && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <form onSubmit={handleSubmit} className="space-y-2">
              <Input type="text" placeholder={t('cal_title_placeholder')} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="flex gap-2">
                <DateInputSegmented value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-28" />
                
              </div>
              <Select
                value={form.category || 'none'}
                onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder={t('cal_category_placeholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tx_no_category')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color || '#9CA3AF' }} />{cat.name}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <textarea
                placeholder={t('cal_note_placeholder')}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
              <Link to="/calendar-categories" className="block text-right text-xs text-muted-foreground underline">
                {t('tx_manage_categories')}
              </Link>
              <Button type="submit" className="w-full">{t('cal_add_event')}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 選了編輯/刪除模式:直接列出當月所有行程供選擇,不用先點日期 */}
      {(actionMode === 'edit' || actionMode === 'delete') && (
        <Card>
          <CardContent className="space-y-3 p-4">
            {!activeId ? (
              <div className="space-y-1">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('cal_no_events_this_day')}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">{actionMode === 'edit' ? t('cal_pick_edit') : t('cal_pick_delete')}</p>
                    {events
                      .slice()
                      .sort((a, b) => a.start_at.localeCompare(b.start_at))
                      .map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => pickEvent(ev)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                          <span className="text-xs text-muted-foreground">{ev.start_at.slice(0, 10)}</span>
                          <span>{ev.title}</span>
                          {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                        </button>
                      ))}
                  </>
                )}
              </div>
            ) : actionMode === 'edit' ? (
              <form onSubmit={handleSubmit} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('cal_editing')}</p>
                <Input type="text" placeholder={t('cal_title_placeholder')} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <div className="flex gap-2">
                  <DateInputSegmented value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
                  <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-28" />
                  
                </div>
                <Select
                  value={form.category || 'none'}
                  onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}
                >
                  <SelectTrigger><SelectValue placeholder={t('cal_category_placeholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('tx_no_category')}</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color || '#9CA3AF' }} />{cat.name}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <textarea
                  placeholder={t('cal_note_placeholder')}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">{t('tx_save_edit')}</Button>
                  <Button type="button" variant="outline" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('cal_confirm_delete_title')}</p>
                <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                  <p>{form.title}</p>
                  <p>{form.date} {form.category && `· ${form.category}`}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>{t('tx_confirm_delete')}</Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-3 flex gap-2">
        {[
          { key: 'search', label: t('search_title') },
          { key: 'categories', label: t('tx_manage_categories') },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => togglePanel(key)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors ${panel === key ? 'border-primary bg-primary font-medium text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {panel === 'categories' && (
        <div className="mt-3">
          <Categories scope="calendar" embedded onChanged={load} />
        </div>
      )}

      {/* 點選「查詢」才展開 */}
      <Card className={`mt-3 ${panel === 'search' ? '' : 'hidden'}`}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('search_title')}</p>
            {hasFilter && (
              <button type="button" onClick={() => setFilters(emptyFilters)} className="text-xs text-muted-foreground underline">
                {t('search_clear')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t('search_date_from')}</span>
              <Input type="date" value={filters.from} onChange={(e) => setFilter('from')(e.target.value)} />
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t('search_date_to')}</span>
              <Input type="date" value={filters.to} onChange={(e) => setFilter('to')(e.target.value)} />
            </div>
            <div className="col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">{t('cal_search_by_category')}</span>
              <Select value={filters.category || 'all'} onValueChange={(v) => setFilter('category')(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('search_all_categories')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color || '#9CA3AF' }} />{cat.name}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">{t('cal_search_keyword')}</span>
              <Input type="text" placeholder={t('cal_search_placeholder')} value={filters.keyword} onChange={(e) => setFilter('keyword')(e.target.value)} />
            </div>
          </div>

          {!hasFilter ? (
            <p className="text-xs text-muted-foreground">{t('cal_search_hint')}</p>
          ) : searching ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('cal_no_search_results')}</p>
          ) : (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground">{t('search_count_prefix')}{searchResults.length}{t('search_count_suffix')}</p>
              <div className="max-h-72 space-y-0.5 overflow-y-auto">
                {searchResults.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                      <span className="truncate">{ev.title}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{ev.start_at.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      </div>
      </div>

      {loading && <p className="mt-4 text-sm text-muted-foreground">{t('loading')}</p>}
    </div>
  );
}

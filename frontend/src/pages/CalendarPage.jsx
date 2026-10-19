import { useEffect, useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { ReadOnlyNotice } from '../components/PlanNotice';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import DateInputSegmented from '../components/DateInputSegmented';
import { REMIND_TIMED, REMIND_ALL_DAY, normalizeRemind } from '../lib/eventRemind';
import CalendarSubNav from '../components/CalendarSubNav';
import Categories from './Categories';
import MonthSwitcher from '../components/MonthSwitcher';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ymd } from '../lib/recurrence';

// 行程日期一律用本地時間(台灣早上 8 點前的行程,UTC 日期會是前一天)
const localKey = (iso) => ymd(new Date(iso));
const hhmm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const isMidnight = (iso) => hhmm(iso) === '00:00';
const startOfWeek = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());

function pastelForDate(dateKey) {
  // 顏色定義在 index.css(--pastel-1~6),石墨灰主題會自動換成灰階
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) hash = (hash * 31 + dateKey.charCodeAt(i)) % 6;
  return `var(--pastel-${(Math.abs(hash) % 6) + 1})`;
}

const emptyFilters = { from: '', to: '', category: '', keyword: '' };

const emptyForm = { title: '', date: '', time: '', end_date: '', end_time: '', note: '', category: '', color: '#4F46E5', remind: 'none' };

// 提醒選項(分鐘,存在 remind_before_minutes):有時間的行程 / 全天行程各一組
export default function CalendarPage() {
  const { t } = useLanguage();
  const { can } = usePlan();
  const canCal = can('calendar');
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  // 月檢視 / 週檢視
  const [view, setView] = useState('month');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [monthDate, setMonthDate] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const [actionMode, setActionMode] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const monthStart = (view === 'week' ? weekStart : new Date(year, month, 1)).toISOString();
      const monthEnd = (view === 'week' ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7) : new Date(year, month + 1, 1)).toISOString();
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

  useEffect(() => { load(); }, [monthDate, view, weekStart]);
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('yy:data-changed', onChanged);
    return () => window.removeEventListener('yy:data-changed', onChanged);
  }, [monthDate, view, weekStart]);

  function changeMonth(m) {
    setMonthDate(m);
    setSelectedDay(null);
    setActiveId(null);
  }

  function switchActionMode(newMode) {
    setActionMode(newMode);
    setActiveId(null);
    setForm({ ...emptyForm, date: selectedDay || '' });
  }

  function toDateInputValue(isoString) {
    return localKey(isoString);
  }

  function toTimeInputValue(isoString) {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function pickEvent(ev) {
    setActiveId(ev.id);
    setConfirmDelete(false);
    setForm({
      title: ev.title,
      date: toDateInputValue(ev.start_at),
      time: toTimeInputValue(ev.start_at),
      note: ev.note || '',
      category: ev.category || '',
      color: ev.color || '#4F46E5',
      remind: ev.remind_before_minutes == null ? 'none' : String(ev.remind_before_minutes),
      ...(() => {
        // 有結束時間(且晚於開始)才帶入
        if (!ev.end_at || ev.end_at <= ev.start_at) return { end_date: '', end_time: '' };
        const sameDay = localKey(ev.end_at) === localKey(ev.start_at);
        return { end_date: sameDay ? '' : localKey(ev.end_at), end_time: isMidnight(ev.end_at) && !sameDay ? '' : hhmm(ev.end_at) };
      })(),
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
      // 結束:可只填結束時間(同一天),或填結束日期(跨日)
      end_at: form.end_date || form.end_time
        ? new Date(`${form.end_date || form.date}T${form.end_time || (form.end_date ? '23:59' : form.time || '00:00')}:00`).toISOString()
        : null,
      category: form.category || null,
      color: form.category ? categoryColor(form.category) : '#9CA3AF',
      note: form.note || null,
      remind_before_minutes: (() => {
        const r = normalizeRemind(form.remind, !!form.time);
        return r === 'none' ? null : Number(r);
      })(),
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

  // 跨日行程會出現在開始到結束的每一天
  const eventsByDay = events.reduce((acc, ev) => {
    const start = new Date(localKey(ev.start_at) + 'T00:00:00');
    const endKey = ev.end_at && ev.end_at > ev.start_at ? localKey(ev.end_at) : localKey(ev.start_at);
    for (let d = new Date(start), i = 0; ymd(d) <= endKey && i < 62; d.setDate(d.getDate() + 1), i += 1) {
      (acc[ymd(d)] ||= []).push(ev);
    }
    return acc;
  }, {});

  // 行程時間文字:全天 / 10:00 / 10:00–12:00 / 10/14–10/16
  function timeRange(ev) {
    const hasEnd = ev.end_at && ev.end_at > ev.start_at;
    const multiDay = hasEnd && localKey(ev.end_at) !== localKey(ev.start_at);
    if (multiDay) return `${localKey(ev.start_at).slice(5).replace('-', '/')}–${localKey(ev.end_at).slice(5).replace('-', '/')}`;
    if (isMidnight(ev.start_at) && !hasEnd) return t('home_all_day');
    return hasEnd ? `${hhmm(ev.start_at)}–${hhmm(ev.end_at)}` : hhmm(ev.start_at);
  }

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
  // 查詢/管理分類的內容:手機版放在功能列下方,桌機版放在右側操作區塊下方
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // 新增/編輯/查詢/管理分類 四選一(手機、網頁相同;再點一次已選的項目 = 取消)
  function selectMobile(key) {
    // 每次切換功能,下方明細回到「未點選日期」的空白狀態
    setSelectedDay(null);
    if (key === 'search' || key === 'categories') {
      if (panel === key) { togglePanel(key); return; }
      setActionMode(null);
      setActiveId(null);
      togglePanel(key);
      return;
    }
    if (panel) togglePanel(panel);
    if (actionMode === key && !panel) { setActionMode(null); setActiveId(null); return; }
    switchActionMode(key);
  }

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

  const panelContent = (
    <>
      {panel === 'categories' && !isDesktop && (
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
                    <span className="shrink-0 text-xs text-muted-foreground">{localKey(ev.start_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-calendar)', '--ring': 'var(--module-calendar)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('cal_pageTitle')}<span className="ml-3">{year}.{String(month + 1).padStart(2, '0')}</span></h1>
      <CalendarSubNav />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:grid-rows-[auto_1fr] md:items-start md:gap-x-6">
      <div className="md:col-start-2 md:row-start-1">

      {/* Action mode switch: 新增 / 編輯(含刪除) / 查詢 / 管理分類 — 跟記帳頁一致,放在標題下方 */}
      {/* 方案沒有行事曆功能:只能查看與查詢 */}
      <ReadOnlyNotice feature="calendar" />
      <div className="mb-3 grid grid-cols-6 gap-1 rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
        {canCal && <>
        <button
          onClick={() => selectMobile('add')}
          className={`col-span-3 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'add' && !panel ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
        >{t('mode_add')}</button>
        <button
          onClick={() => selectMobile('edit')}
          className={`col-span-3 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'edit' && !panel ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
        >{t('mode_edit')}</button>
        </>}
        {[
          { key: 'search', label: t('search_title') },
          ...(canCal ? [{ key: 'categories', label: t('tx_manage_categories') }] : []),
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectMobile(key)}
            className={`${canCal ? 'col-span-3' : 'col-span-6'} rounded-md px-2 py-1.5 transition-colors ${panel === key ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!isDesktop && <div className="mb-3">{panelContent}</div>}

      </div>

      {/* 管理分類:不顯示月曆(桌機版把分類管理放在月曆原本的位置) */}
      {panel === 'categories' && isDesktop && (
        <div className="md:col-start-1 md:row-span-2 md:row-start-1">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">{t('tx_manage_categories')}</p>
            <button type="button" onClick={() => togglePanel('categories')} className="text-xs text-muted-foreground underline">{t('cal_back_to_calendar')}</button>
          </div>
          <Categories scope="calendar" embedded onChanged={load} />
        </div>
      )}
      {/* 手機版:查詢、新增時不顯示行事曆;管理分類時手機、網頁都不顯示 */}
      <div className={`md:col-start-1 md:row-span-2 md:row-start-1 ${panel === 'search' || (actionMode === 'add' && !panel) ? 'hidden md:block' : ''} ${panel === 'categories' ? 'hidden' : ''}`}>
      <div className="mb-3 flex gap-2">
        <div className="flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
          {['month', 'week'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); setSelectedDay(null); if (v === 'week') setWeekStart(startOfWeek(new Date())); }}
              className={`rounded-md px-3 py-1 transition-colors ${view === v ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
            >
              {t(`cal_view_${v}`)}
            </button>
          ))}
        </div>
        {view === 'month' ? (
          <MonthSwitcher month={monthDate} onChange={changeMonth} t={t} className="min-w-0 flex-1" />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-border bg-card px-1 py-1 text-sm shadow-sm">
            <button type="button" aria-label="prev week" onClick={() => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7))} className="rounded-md p-1.5 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="font-amount font-medium">
              {weekStart.getMonth() + 1}/{weekStart.getDate()} – {(() => { const e = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6); return `${e.getMonth() + 1}/${e.getDate()}`; })()}
              {ymd(weekStart) !== ymd(startOfWeek(new Date())) && <span className="ml-2 text-xs font-normal text-muted-foreground underline">{t('cal_this_week')}</span>}
            </button>
            <button type="button" aria-label="next week" onClick={() => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7))} className="rounded-md p-1.5 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {view === 'week' && (
        <div className="mb-3 space-y-2 md:grid md:grid-cols-7 md:gap-2 md:space-y-0">
          {Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)).map((d) => {
            const key = ymd(d);
            const list = (eventsByDay[key] || []).slice().sort((a, b) => a.start_at.localeCompare(b.start_at));
            const isToday = key === ymd(new Date());
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDayClick(key)}
                className={`block w-full rounded-lg border bg-card p-2 text-left shadow-sm md:min-h-40 ${selectedDay === key ? 'border-foreground' : 'border-border'}`}
              >
                <p className={`mb-1 text-xs ${isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {weekdays[d.getDay()]} {d.getMonth() + 1}/{d.getDate()}
                </p>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 md:hidden">—</p>
                ) : list.map((ev) => (
                  <p key={ev.id} className="flex items-center gap-1.5 truncate py-0.5 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                    <span className="shrink-0 font-amount text-muted-foreground">{timeRange(ev)}</span>
                    <span className="truncate">{ev.title}</span>
                  </p>
                ))}
              </button>
            );
          })}
        </div>
      )}

      <Card className={`mb-3 ${view === 'week' ? 'hidden' : ''}`}>
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
                    <span className="shrink-0 font-amount text-xs text-muted-foreground">{timeRange(ev)}</span>
                    <span>{ev.title}</span>
                    {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                    {ev.remind_before_minutes != null && <span className="ml-auto text-xs">🔔</span>}
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
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-xs text-muted-foreground">{t('cal_end')}</span>
                <Input type="date" value={form.end_date} min={form.date || undefined} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="min-w-0 flex-1" />
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-28" />
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">🔔 {t('cal_remind')}</span>
                <Select value={normalizeRemind(form.remind, !!form.time)} onValueChange={(v) => setForm({ ...form, remind: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(form.time ? REMIND_TIMED : REMIND_ALL_DAY).map((v) => (
                      <SelectItem key={v} value={v}>{t(`cal_remind_${v.replace('-', 'm')}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* 選了編輯模式:先選日期,再選當日行程(刪除在編輯表單內) */}
      {actionMode === 'edit' && !activeId && (
        !selectedDay ? (
          <p className="px-1 text-sm text-muted-foreground">{t('cal_pick_day_edit')}</p>
        ) : (
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="mb-1 text-sm font-medium">{selectedDay}{t('cal_events_of_day_suffix')}</p>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('cal_no_events_this_day')}</p>
              ) : (
                selectedDayEvents
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
                      <span>{ev.title}</span>
                      {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                      {ev.remind_before_minutes != null && <span className="ml-auto text-xs">🔔</span>}
                    </button>
                  ))
              )}
            </CardContent>
          </Card>
        )
      )}

      {actionMode === 'edit' && activeId && (
        <Card>
          <CardContent className="space-y-3 p-4">
            {(
              <form onSubmit={handleSubmit} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('cal_editing')}</p>
                <Input type="text" placeholder={t('cal_title_placeholder')} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <div className="flex gap-2">
                  <DateInputSegmented value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
                  <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-28" />
                  
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs text-muted-foreground">{t('cal_end')}</span>
                  <Input type="date" value={form.end_date} min={form.date || undefined} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="min-w-0 flex-1" />
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-28" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-muted-foreground">🔔 {t('cal_remind')}</span>
                  <Select value={normalizeRemind(form.remind, !!form.time)} onValueChange={(v) => setForm({ ...form, remind: v })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(form.time ? REMIND_TIMED : REMIND_ALL_DAY).map((v) => (
                        <SelectItem key={v} value={v}>{t(`cal_remind_${v.replace('-', 'm')}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>{t('mode_delete')}</Button>
                  <Button type="button" variant="outline" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
                </div>
                {confirmDelete && (
                  <div className="space-y-2 rounded-md border border-border p-2">
                    <p className="text-sm">{t('cal_confirm_delete_title')}</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>{t('tx_confirm_delete')}</Button>
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>{t('cancel')}</Button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {isDesktop && panelContent}

      </div>
      </div>

      {loading && <p className="mt-4 text-sm text-muted-foreground">{t('loading')}</p>}
    </div>
  );
}

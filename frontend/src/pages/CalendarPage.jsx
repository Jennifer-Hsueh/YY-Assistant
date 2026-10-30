import { useEffect, useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { askUpgrade } from '../components/PlanNotice';
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
import EventPeople, { EventInvites } from '../components/EventPeople';
import CalendarSwitcher, { CalendarInvites } from '../components/CalendarSwitcher';
import { AnnivIcon } from './Anniversaries';
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

const emptyForm = { title: '', date: '', time: '', end_date: '', end_time: '', note: '', category: '', color: '#4F46E5', remind: 'none', calendar_id: '' };
const readLS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 無痕模式 */ } };

// 提醒選項(分鐘,存在 remind_before_minutes):有時間的行程 / 全天行程各一組
export default function CalendarPage() {
  const { t, language } = useLanguage();
  const [inviteIds, setInviteIds] = useState([]); // 要邀請的好友
  const [annivs, setAnnivs] = useState([]); // 紀念日(顯示在行事曆上)
  useEffect(() => { api.listAnniversaries().then((d) => setAnnivs(d.anniversaries)).catch(() => {}); }, []);
  const { can } = usePlan();
  const canCal = can('calendar');
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  // 共用行事曆:顯示方式(overlay 疊在一起 / switch 分開切換)與目前看的那本('' = 我的行事曆)
  const [calendars, setCalendars] = useState([]);
  const [calInvites, setCalInvites] = useState([]);
  const [calMode, setCalModeState] = useState(() => (readLS('yy_cal_mode', 'overlay') === 'switch' ? 'switch' : 'overlay'));
  const [calCurrent, setCalCurrentState] = useState(() => readLS('yy_cal_current', ''));
  const setCalMode = (m) => { setCalModeState(m); writeLS('yy_cal_mode', m); setSelectedDay(null); setActiveId(null); };
  const setCalCurrent = (id) => { setCalCurrentState(id || ''); writeLS('yy_cal_current', id || ''); setSelectedDay(null); setActiveId(null); };
  const loadCalendars = () => api.listCalendars().then((d) => {
    setCalendars(d.calendars || []);
    setCalInvites(d.invites || []);
    if (calCurrent && !(d.calendars || []).some((c) => c.id === calCurrent)) setCalCurrent('');
  }).catch(() => {});
  useEffect(() => { loadCalendars(); }, []);
  const calOf = (ev) => (ev.calendar_id ? calendars.find((c) => c.id === ev.calendar_id) : null);
  // 分開切換時只看目前那本;疊在一起時全部顯示
  const inView = (ev) => calMode === 'overlay' || (ev.calendar_id || '') === (calCurrent || '');
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
  // 編輯模式下勾選當天多個行程,一次刪除
  // 編輯 → 先選「刪除」(勾選多筆) 或「修改」(點一筆)
  const [editSub, setEditSub] = useState(null);
  const [checked, setChecked] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

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
      loadCalendars();
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
    setEditSub(null);
    setActiveId(null);
    setForm({ ...emptyForm, date: selectedDay || '', calendar_id: calMode === 'switch' ? calCurrent : '' });
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
    setInviteIds([]);
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
    setForm({ ...emptyForm, date: selectedDay || '', calendar_id: form.calendar_id });
    setActiveId(null);
    setInviteIds([]);
  }

  // 新增到哪一本:分開切換時是目前那本;疊在一起時由表單選
  const targetCal = actionMode === 'edit' ? '' : calMode === 'switch' ? calCurrent : form.calendar_id;
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
      ...(inviteIds.length && !targetCal ? { invite_ids: inviteIds } : {}),
      ...(targetCal && !(actionMode === 'edit' && activeId) ? { calendar_id: targetCal } : {}),
    };
    if (actionMode === 'edit' && activeId) {
      await api.updateEvent(activeId, payload);
    } else {
      await api.createEvent(payload);
    }
    resetAfterAction();
    load();
  }

  const activeEvent = events.find((e) => e.id === activeId) || null;
  const isMember = !!activeEvent && activeEvent.is_owner === false;

  // 換日或離開編輯時清掉勾選
  useEffect(() => { setChecked([]); setBulkConfirm(false); }, [selectedDay, actionMode, editSub]);
  useEffect(() => { setEditSub(null); }, [actionMode]);
  const toggleChecked = (id) => { setBulkConfirm(false); setChecked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])); };
  async function handleBulkDelete() {
    setBulkBusy(true);
    try {
      for (const id of checked) await api.deleteEvent(id);
    } catch (err) {
      console.error(err);
    } finally {
      setBulkBusy(false);
      setChecked([]);
      setBulkConfirm(false);
      load();
    }
  }

  async function handleConfirmDelete() {
    await api.deleteEvent(activeId);
    resetAfterAction();
    load();
  }

  // 跨日行程會出現在開始到結束的每一天
  const eventsByDay = events.filter(inView).reduce((acc, ev) => {
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
    setForm({ ...emptyForm, date: dateKey, calendar_id: form.calendar_id });
  }

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];
  // 紀念日:依目前顯示的年份算出每年的那一天(不循環的只在原本那天)
  const annivByDay = (() => {
    const years = view === 'week'
      ? [weekStart.getFullYear(), new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6).getFullYear()]
      : [year];
    const out = {};
    for (const a of annivs) {
      for (const y of new Set(years)) {
        let key = null;
        if (!a.recurring) key = Number(a.date.slice(0, 4)) === y ? a.date : null;
        else if (a.year_known && y < Number(a.date.slice(0, 4))) key = null;
        else {
          let md = a.date.slice(5);
          if (md === '02-29' && !((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) md = '02-28';
          key = `${y}-${md}`;
        }
        if (key) (out[key] ||= []).push(a);
      }
    }
    return out;
  })();
  const selectedDayAnnivs = selectedDay ? (annivByDay[selectedDay] || []) : [];
  const weekdays = t('cal_weekdays');
  const categoryColor = (name) => categories.find((c) => c.name === name)?.color || '#9CA3AF';
  // 共用行事曆的行程:疊在一起時用那本的顏色;分開切換時用分類顏色(沒有這個分類就用那本的顏色)
  const eventColor = (ev) => {
    const cal = calOf(ev);
    if (cal) {
      if (calMode === 'overlay') return cal.color;
      return (ev.category && categories.find((c) => c.name === ev.category)?.color) || ev.color || cal.color;
    }
    return ev.category ? categoryColor(ev.category) : '#9CA3AF';
  };
  const CalTag = ({ ev }) => {
    const cal = calMode === 'overlay' ? calOf(ev) : null;
    return cal ? <span className="shrink-0 rounded px-1 text-[10px] text-white" style={{ backgroundColor: cal.color }}>{cal.name}</span> : null;
  };

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
    // 方案沒有行事曆功能:只能查詢,其他功能跳出提示
    if (!canCal && key !== 'search') { askUpgrade('calendar'); return; }
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
            if (!inView(ev)) return false;
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
      <EventInvites onChanged={load} />
      <CalendarInvites invites={calInvites} onChanged={(joinedId) => { if (joinedId && calMode === 'switch') setCalCurrent(joinedId); load(); }} />
      <CalendarSwitcher calendars={calendars} mode={calMode} setMode={setCalMode} current={calCurrent} setCurrent={setCalCurrent} reload={() => { loadCalendars(); load(); }} canEdit={canCal} />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:grid-rows-[auto_1fr] md:items-start md:gap-x-6">
      <div className="md:col-start-2 md:row-start-1">

      {/* Action mode switch: 新增 / 編輯(含刪除) / 查詢 / 管理分類 — 跟記帳頁一致,放在標題下方 */}
      {/* 方案沒有行事曆功能:只能查看與查詢 */}
      <div className="mb-3 grid grid-cols-6 gap-1 rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
        {<>
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
          { key: 'categories', label: t('tx_manage_categories') },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectMobile(key)}
            className={`col-span-3 rounded-md px-2 py-1.5 transition-colors ${panel === key ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
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
                {(annivByDay[key] || []).map((a) => (
                  <p key={a.id} className="flex items-center gap-1.5 truncate py-0.5 text-xs">
                    <AnnivIcon icon={a.icon} className="h-4 w-4 text-[11px]" />
                    <span className="truncate">{a.title}</span>
                  </p>
                ))}
                {list.length === 0 && !(annivByDay[key] || []).length ? (
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
              const hasEvents = dayEvents.length > 0 || !!annivByDay[dateKey];
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleDayClick(dateKey)}
                  className={`flex min-h-14 flex-col md:min-h-20 items-center gap-0.5 rounded-md py-1 text-xs ${isSelected ? 'ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                  style={hasEvents ? { backgroundColor: pastelForDate(dateKey) } : undefined}
                >
                  <span>{day}</span>
                  {(annivByDay[dateKey] || []).slice(0, 1).map((a) => (
                    <span key={a.id} title={a.title} className="flex w-full items-center gap-0.5 truncate px-0.5 text-xs text-black">
                      <AnnivIcon icon={a.icon} className="h-3.5 w-3.5 text-[10px]" />
                      <span className="truncate">{a.title}</span>
                    </span>
                  ))}
                  {dayEvents.slice(0, (annivByDay[dateKey] || []).length ? 1 : 2).map((ev) => (
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
            {selectedDayAnnivs.map((a) => (
              <Link key={a.id} to="/anniversaries" className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/50">
                <AnnivIcon icon={a.icon} className="h-5 w-5" />
                <span>{a.title}</span>
                {(() => {
                  // 這一天是第幾週年/幾歲(看的是哪一年就算哪一年)
                  const n = a.year_known && a.recurring ? Number(selectedDay.slice(0, 4)) - Number(a.date.slice(0, 4)) : 0;
                  if (n <= 0 || !(a.show_age || a.show_years)) return null;
                  return <span className="text-xs text-muted-foreground">{a.show_age ? (language === 'en' ? `age ${n}` : `${n} 歲`) : (language === 'en' ? `${n} yrs` : `${n} 週年`)}</span>;
                })()}
              </Link>
            ))}
            {selectedDayEvents.length === 0 && !selectedDayAnnivs.length ? (
              <p className="text-sm text-muted-foreground">{t('cal_no_events_this_day')}</p>
            ) : (
              <div className="space-y-1">
                {selectedDayEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                    <span className="shrink-0 font-amount text-xs text-muted-foreground">{timeRange(ev)}</span>
                    <span>{ev.title}</span>
                    {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                    <CalTag ev={ev} />
                    {ev.calendar_id && !ev.is_owner && ev.owner?.name && <span className="text-xs text-muted-foreground">· {ev.owner.name}</span>}
                    {ev.shared && <span className="text-xs" title={ev.owner?.name || ''}>👥</span>}
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
              {calMode === 'overlay' && calendars.length > 0 && (
                <Select value={form.calendar_id || 'mine'} onValueChange={(v) => setForm({ ...form, calendar_id: v === 'mine' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mine">{t('cal_my_calendar')}</SelectItem>
                    {calendars.map((c) => (
                      <SelectItem key={c.id} value={c.id}><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {targetCal ? (
                <p className="text-xs text-muted-foreground">{t('cal_shared_cal_hint')}</p>
              ) : (
                <EventPeople selected={inviteIds} onChange={setInviteIds} />
              )}
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
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
          {[['delete', t('mode_delete')], ['modify', t('edit_sub_modify')]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setEditSub(k); setActiveId(null); }} className={`rounded-md px-2 py-1.5 transition-colors ${editSub === k ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{label}</button>
          ))}
        </div>
      )}
      {actionMode === 'edit' && !activeId && editSub && (
        !selectedDay ? (
          <p className="px-1 text-sm text-muted-foreground">{t('cal_pick_day_edit')}</p>
        ) : (
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="mb-1 text-sm font-medium">{selectedDay}{t('cal_events_of_day_suffix')}</p>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('cal_no_events_this_day')}</p>
              ) : (
                <>
                {selectedDayEvents
                  .slice()
                  .sort((a, b) => a.start_at.localeCompare(b.start_at))
                  .map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => (editSub === 'delete' ? toggleChecked(ev.id) : pickEvent(ev))}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                    >
                      {editSub === 'delete' && (
                        <input
                          type="checkbox"
                          aria-label={t('bulk_select')}
                          className="pointer-events-none h-4 w-4 shrink-0 accent-[var(--module-calendar)]"
                          checked={checked.includes(ev.id)}
                          readOnly
                          tabIndex={-1}
                        />
                      )}
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                      <span className="truncate">{ev.title}</span>
                      {ev.category && <span className="text-xs text-muted-foreground">({ev.category})</span>}
                      {ev.shared && <span className="text-xs" title={ev.owner?.name || ''}>👥</span>}
                      {ev.remind_before_minutes != null && <span className="ml-auto text-xs">🔔</span>}
                    </button>
                  ))}
                {/* 勾選多個行程一次刪除 */}
                {editSub === 'delete' && <div className="mt-2 space-y-2 border-t border-dashed border-border pt-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{checked.length ? t('bulk_count').replace('{n}', checked.length) : t('bulk_hint')}</span>
                    <span className="ml-auto flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => { setBulkConfirm(false); setChecked(checked.length === selectedDayEvents.length ? [] : selectedDayEvents.map((ev) => ev.id)); }}>
                        {checked.length === selectedDayEvents.length ? t('bulk_none') : t('bulk_all')}
                      </Button>
                      {checked.length > 0 && !bulkConfirm && (
                        <Button type="button" size="sm" variant="destructive" onClick={() => setBulkConfirm(true)}>{t('bulk_delete').replace('{n}', checked.length)}</Button>
                      )}
                    </span>
                  </div>
                  {bulkConfirm && (
                    <div className="space-y-2 rounded-md border border-destructive/40 p-2">
                      <p>{t('bulk_confirm').replace('{n}', checked.length)}</p>
                      {selectedDayEvents.some((ev) => ev.shared && checked.includes(ev.id)) && <p className="text-xs text-muted-foreground">{t('bulk_shared_note')}</p>}
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="destructive" className="flex-1" disabled={bulkBusy} onClick={handleBulkDelete}>{bulkBusy ? t('loading') : t('tx_confirm_delete')}</Button>
                        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setBulkConfirm(false)}>{t('cancel')}</Button>
                      </div>
                    </div>
                  )}
                </div>}
                </>
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
                  disabled={isMember}
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
                {activeEvent && !activeEvent.calendar_id && <EventPeople event={activeEvent} selected={inviteIds} onChange={setInviteIds} onRemoved={load} />}
                {activeEvent?.calendar_id && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: calOf(activeEvent)?.color }} />{calOf(activeEvent)?.name}・{t('cal_shared_cal_hint')}</p>}
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">{t('tx_save_edit')}</Button>
                  <Button type="button" variant="outline" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
                </div>
                {confirmDelete && (
                  <div className="space-y-2 rounded-md border border-border p-2">
                    <p className="text-sm">{isMember ? (language === 'en' ? 'Leave this event? It will be removed from your calendar.' : '確定不參加這個行程？行程會從你的行事曆移除。') : activeEvent?.shared ? (language === 'en' ? 'Delete this event for everyone?' : '刪除後，所有參與者的這個行程都會一起刪除。') : t('cal_confirm_delete_title')}</p>
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

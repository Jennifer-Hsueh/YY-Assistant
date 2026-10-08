import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import CalendarSubNav from '../components/CalendarSubNav';

const GRAY = '#9CA3AF';

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function localDate(iso) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function CalendarStats() {
  const { t } = useLanguage();
  const weekdays = t('cal_weekdays');
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => monthKey(new Date()));

  const today = localDate(new Date().toISOString());
  const [filters, setFilters] = useState({
    from: `${today.slice(0, 7)}-01`,
    to: today,
    category: 'all',
    keyword: '',
    groupBy: 'category',
  });
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      try {
        const [{ events }, { categories }] = await Promise.all([
          api.listEvents({}),
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
    load();
  }, []);

  const categoryColor = (name) => categories.find((c) => c.name === name)?.color || GRAY;

  function shiftMonth(delta) {
    const [y, m] = month.split('-').map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  }

  // 月份總覽
  const monthEvents = events.filter((ev) => localDate(ev.start_at).slice(0, 7) === month);
  const busyDays = new Set(monthEvents.map((ev) => localDate(ev.start_at))).size;
  const monthByCat = monthEvents.reduce((acc, ev) => {
    const k = ev.category || t('tx_no_category');
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(monthByCat).sort((a, b) => b[1] - a[1])[0];

  // 條件分析
  const filtered = events.filter((ev) => {
    const d = localDate(ev.start_at);
    if (filters.from && d < filters.from) return false;
    if (filters.to && d > filters.to) return false;
    if (filters.category !== 'all' && (ev.category || '') !== filters.category) return false;
    if (filters.keyword) {
      const q = filters.keyword.toLowerCase();
      if (!`${ev.title || ''} ${ev.note || ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const groupKey = (ev) => {
    if (filters.groupBy === 'month') return localDate(ev.start_at).slice(0, 7);
    if (filters.groupBy === 'weekday') return String(new Date(`${localDate(ev.start_at)}T12:00:00`).getDay());
    return ev.category || t('tx_no_category');
  };
  const counts = filtered.reduce((acc, ev) => {
    const k = groupKey(ev);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const groups = Object.entries(counts).sort((a, b) => {
    if (filters.groupBy === 'month') return a[0].localeCompare(b[0]);
    if (filters.groupBy === 'weekday') return Number(a[0]) - Number(b[0]);
    return b[1] - a[1];
  });
  const groupLabel = (k) => (filters.groupBy === 'weekday' ? weekdays[Number(k)] : k);
  const groupColor = (k) => (filters.groupBy === 'category' ? categoryColor(k) : 'var(--module-calendar)');

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-calendar)', '--ring': 'var(--module-calendar)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('sub_stats')}</h1>
      <CalendarSubNav />

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-center gap-4">
                <button type="button" onClick={() => shiftMonth(-1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="font-amount text-base font-medium">{month}</span>
                <button type="button" onClick={() => shiftMonth(1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">{t('cstats_events')}</p>
                  <p className="mt-1 font-amount text-lg font-semibold" style={{ color: 'var(--module-calendar)' }}>{monthEvents.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('cstats_days')}</p>
                  <p className="mt-1 font-amount text-lg font-semibold">{busyDays}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t('cstats_top')}</p>
                  {topCategory ? (
                    <p className="mt-1 flex items-center justify-center gap-1.5 truncate text-lg font-semibold">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(topCategory[0]) }} />
                      <span className="truncate">{topCategory[0]}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-lg font-semibold">—</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium">{t('stats_custom')}</p>

              <div className="space-y-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6 md:space-y-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="min-w-0 flex-1" />
                    <span className="text-muted-foreground">~</span>
                    <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="min-w-0 flex-1" />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filters.category} onValueChange={(v) => setFilter('category', v)}>
                      <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('stats_all_categories')}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color || GRAY }} />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filters.groupBy} onValueChange={(v) => setFilter('groupBy', v)}>
                      <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">{t('stats_group_category')}</SelectItem>
                        <SelectItem value="month">{t('stats_group_month')}</SelectItem>
                        <SelectItem value="weekday">{t('cstats_group_weekday')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="text" placeholder={t('cstats_keyword')} value={filters.keyword} onChange={(e) => setFilter('keyword', e.target.value)} />
                </div>

                <div className="pt-2 md:pt-0">
                  <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
                    <span className="text-sm text-muted-foreground">{t('stats_total')}</span>
                    <span className="font-amount text-xl font-semibold" style={{ color: 'var(--module-calendar)' }}>
                      {filtered.length}{t('stats_count_suffix')}
                    </span>
                  </div>
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('stats_no_match')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {groups.map(([k, count]) => {
                        const pct = filtered.length ? (count / filtered.length) * 100 : 0;
                        return (
                          <li key={k}>
                            <div className="mb-1 flex items-baseline justify-between text-sm">
                              <span className="flex items-center gap-1.5">
                                {filters.groupBy === 'category' && (
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: groupColor(k) }} />
                                )}
                                {groupLabel(k)}
                              </span>
                              <span className="font-amount">
                                {count}{t('stats_count_suffix')}
                                <span className="ml-2 inline-block w-12 text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted">
                              <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: groupColor(k) }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

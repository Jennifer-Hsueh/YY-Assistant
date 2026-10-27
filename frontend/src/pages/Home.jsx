import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Calendar, Megaphone, PiggyBank, ChevronRight, X, HelpCircle, Heart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useLedger } from '../context/LedgerContext';
import { LedgerInvites } from '../components/LedgerSwitcher';
import { EventInvites } from '../components/EventPeople';
import { AnnivIcon } from './Anniversaries';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import BudgetBars from '../components/BudgetBars';
import { monthTotals, loadRates, ymd } from '../lib/budget';
import { useAnnStatus, dismissAnnBanner } from '../lib/annStatus';
import { MOODS, moodEmoji } from '../lib/moods';
import { CloudSun } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { PlanBanner } from '../components/PlanNotice';
import HomeNotesCard from '../components/HomeNotesCard';
import HomeSlipsCard from '../components/HomeSlipsCard';

// 首頁卡片的淡色漸層底(依模組顏色)
const tint = (color) => ({
  background: `linear-gradient(135deg, color-mix(in srgb, color-mix(in srgb, ${color} 12%, var(--card)) 50%, transparent), color-mix(in srgb, color-mix(in srgb, ${color} 32%, var(--card)) 50%, transparent))`,
});

function CardTitle({ Icon, color, title, to }) {
  const inner = (
    <>
      <Icon className="h-4 w-4" />
      <span className="flex-1">{title}</span>
      {to && <ChevronRight className="h-4 w-4" />}
    </>
  );
  const cls = 'mb-3 flex items-center gap-1.5 text-base font-medium';
  return to ? <Link to={to} className={cls} style={{ color }}>{inner}</Link> : <p className={cls} style={{ color }}>{inner}</p>;
}

export default function Home() {
  const { t } = useLanguage();
  const { ledgers, current } = useLedger();
  // 有多本帳本時,標題加上目前的帳本名稱
  const ledgerTag = ledgers.length > 1 && current ? `・${current.name}` : '';
  const [upcoming, setUpcoming] = useState([]);
  useEffect(() => {
    api.listAnniversaries().then((d) => {
      const list = [
        ...d.anniversaries.map((a) => {
          const en = t('home_date_locale').startsWith('en');
          const n = a.years > 0 ? (a.show_age ? (en ? ` (age ${a.years})` : `（${a.years} 歲）`) : a.show_years ? (en ? ` (${a.years} yrs)` : `（${a.years} 週年）`) : '') : '';
          return { key: `a${a.id}`, icon: <AnnivIcon icon={a.icon} className="h-5 w-5" />, title: `${a.title}${n}`, days: a.days_left };
        }),
        ...d.birthdays.map((b) => ({ key: `b${b.id}`, icon: '🎂', title: b.name || '—', days: b.days_left })),
      ].filter((x) => x.days >= 0 && x.days <= 30).sort((x, y) => x.days - y.days);
      setUpcoming(list);
    }).catch(() => {});
  }, []);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const { banner } = useAnnStatus();
  const { can } = usePlan();
  const [overview, setOverview] = useState(null); // { events, totals, budgets }
  const [mood, setMood] = useState(null);
  // 本日心情:還沒選時直接展開九種天氣;選好後收成右上角的小圓圖示,點一下可以再改
  const [moodOpen, setMoodOpen] = useState(false);
  const todayKey = ymd(new Date());

  // 今日總覽:今日行程、本月消費、預算;心情在設定頁選,首頁角色旁顯示
  useEffect(() => {
    async function loadOverview() {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      try {
        const [{ events }, { transactions }, { accounts }, { budgets }, { moods }] = await Promise.all([
          api.listEvents({ from: dayStart.toISOString(), to: dayEnd.toISOString() }),
          api.listTransactions({ from: monthStart.toISOString(), to: monthEnd.toISOString() }),
          api.listAccounts(),
          api.listBudgets().catch(() => ({ budgets: [] })),
          api.listMoods({ from: todayKey, to: todayKey }).catch(() => ({ moods: [] })),
        ]);
        const rates = await loadRates(api, accounts);
        setOverview({
          events: events.slice().sort((a, b) => a.start_at.localeCompare(b.start_at)),
          totals: monthTotals(transactions, accounts, rates, todayKey.slice(0, 7), todayKey),
          budgets,
        });
        setMood(moods[0]?.mood || null);
        setMoodOpen(!moods[0]?.mood);
      } catch (err) {
        console.error(err);
        setOverview({ events: [], totals: { expense: 0, income: 0, dayExpense: 0, byCategory: {} }, budgets: [] });
      }
    }
    loadOverview();
    window.addEventListener('yy:data-changed', loadOverview);
    return () => window.removeEventListener('yy:data-changed', loadOverview);
  }, []);

  const timeOf = (iso) => {
    const d = new Date(iso);
    return d.getHours() === 0 && d.getMinutes() === 0 ? t('home_all_day') : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setProfile(profile))
      .catch((err) => console.error(err))
      .finally(() => setProfileLoaded(true));
  }, []);

  const HELP_KEY = 'yy_help_card_closed';
  const [helpClosed, setHelpClosed] = useState(() => { try { return localStorage.getItem(HELP_KEY) === '1'; } catch { return false; } });
  const showHelpCard = !helpClosed && profile?.created_at && Date.now() - new Date(profile.created_at).getTime() < 14 * 24 * 60 * 60 * 1000;
  function closeHelpCard() {
    setHelpClosed(true);
    try { localStorage.setItem(HELP_KEY, '1'); } catch { /* ignore */ }
  }

  const displayName = profile?.username || profile?.email?.split('@')[0] || '';


  const moodBtn = can('mood') ? (
    <button
      type="button"
      onClick={() => setMoodOpen((v) => !v)}
      aria-label={t('home_mood')}
      title={t('home_mood')}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card text-base leading-none shadow-sm ${mood ? 'border-border' : 'border-dashed border-muted-foreground/50 text-muted-foreground'}`}
    >
      {mood ? moodEmoji(mood) : <CloudSun className="h-4 w-4" />}
    </button>
  ) : null;

  async function pickMood(key) {
    const next = mood === key ? null : key;
    setMood(next);
    if (next) setMoodOpen(false);
    try { await api.setMood(todayKey, next); } catch (err) { console.error(err); }
  }
  return (
    <div className="relative mx-auto max-w-xl px-4 pt-4 pb-40 md:max-w-5xl md:px-8 md:py-10">
      {/* 浮水印插圖 — 放大 3 倍、更淡,拿掉外層 overflow-hidden 避免被裁切 */}
{profileLoaded && (
  <img
    src="/home-watermark-logo.png"
    alt=""
    className="pointer-events-none fixed z-0 bottom-[calc(88px+env(safe-area-inset-bottom))] right-5 w-[280px] opacity-[0.09] md:absolute md:bottom-[-30px] md:right-[-8px] md:w-[340px]"
    style={{ maxWidth: 'none' }}
  />
)}

      <h1 className="page-title-row page-title mb-1 font-semibold" style={{ fontSize: '18.5px' }}>{t('nav_home')}</h1>
      <LedgerInvites />
      <EventInvites />
      {/* 重要公告橫幅:點進公告頁或按 ✕ 就不再出現 */}
      {banner && (
        <div
          className="relative z-30 mb-3 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm md:mb-5"
          style={{ background: 'color-mix(in srgb, var(--module-recurring) 18%, var(--card))' }}
        >
          <Megaphone className="h-4 w-4 shrink-0" style={{ color: 'var(--module-recurring)' }} />
          <Link to="/announcements" className="min-w-0 flex-1 truncate">
            <span className="mr-1.5 font-medium" style={{ color: 'var(--module-recurring)' }}>{t('ann_important')}</span>
            {banner.title}
          </Link>
          <button type="button" aria-label={t('ann_close')} onClick={dismissAnnBanner} className="shrink-0 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 方案提醒:試用快結束、快到期、寬限期、需要選擇基本功能 */}
      <div className="mt-2"><PlanBanner /></div>

      {/* 新使用者(註冊 14 天內)才顯示,按 ✕ 後不再出現 */}
      {showHelpCard && (
        <div className="relative z-30 mt-2 flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-sm">
          <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Link to="/help" className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">{t('help_card')}</Link>
          <button type="button" aria-label={t('ann_close')} onClick={closeHelpCard} className="shrink-0 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 日期、招呼語;名字後面是今天的心情(點一下可以選或改) */}
      <div className="mb-3 mt-1 md:mb-5">
        <p className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize: '15.4px' }}>
          {new Intl.DateTimeFormat(t('home_date_locale'), { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}
          {!displayName && moodBtn}
        </p>
        {displayName && (
          <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground" style={{ fontSize: '15.4px' }}>
            <span className="min-w-0 truncate">{t('home_welcome_prefix')}{displayName}{t('home_welcome_suffix')}</span>
            {moodBtn}
          </p>
        )}
      </div>

      {can('mood') && moodOpen && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-3 py-1.5 shadow-sm md:mb-5">
          <span className="text-xs text-muted-foreground">{t('home_mood_hint')}</span>
          <div className="flex flex-1 items-center gap-0.5">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-label={t(`mood_${m.key}`)}
                title={t(`mood_${m.key}`)}
                onClick={() => pickMood(m.key)}
                className={`rounded-md px-1 py-0.5 text-base leading-none transition-all hover:scale-110 hover:opacity-100 md:text-lg ${mood === m.key ? 'scale-110 bg-muted' : 'opacity-70'}`}
              >
                {m.emoji}
              </button>
            ))}
          </div>
          <Link to="/community/mood" className="text-[11px] text-muted-foreground underline">{t('home_mood_share')}</Link>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 md:gap-5">
        {/* 今日行程 */}
        <Card className="relative z-10 border-none" style={tint('var(--module-calendar)')}>
          <CardContent className="p-4 md:p-5">
            <CardTitle Icon={Calendar} color="var(--module-calendar)" title={t('today_events')} to="/calendar" />
            {!overview ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : overview.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('no_events_today')}</p>
            ) : (
              <ul className="space-y-1.5">
                {overview.events.slice(0, 5).map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ev.color || '#9CA3AF' }} />
                    <span className="w-12 shrink-0 font-amount text-xs text-muted-foreground">{timeOf(ev.start_at)}</span>
                    <span className="truncate">{ev.title}</span>
                    {ev.remind_before_minutes != null && <span className="ml-auto text-xs">🔔</span>}
                  </li>
                ))}
                {overview.events.length > 5 && <li className="text-xs text-muted-foreground">+{overview.events.length - 5}</li>}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 本月累積消費 */}
        <Card className="relative z-10 border-none" style={tint('var(--module-transactions)')}>
          <CardContent className="p-4 md:p-5">
            <CardTitle Icon={Wallet} color="var(--module-transactions)" title={`${t('home_month_spend')}${ledgerTag}`} to="/transactions" />
            {!overview ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : (
              <>
                <p className="font-amount text-3xl font-semibold">
                  <span className="mr-1.5 text-sm font-normal text-muted-foreground">TWD</span>
                  {Math.round(overview.totals.expense).toLocaleString()}
                </p>
                <p className="mt-1 font-amount text-xs text-muted-foreground">
                  {t('home_today_spend')} TWD {Math.round(overview.totals.dayExpense || 0).toLocaleString()}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 預算使用進度 */}
        <Card className="relative z-10 border-none" style={tint('var(--module-recurring)')}>
          <CardContent className="p-4 md:p-5">
            <CardTitle Icon={PiggyBank} color="var(--module-recurring)" title={`${t('home_budget')}${ledgerTag}`} to="/ledger-stats" />
            {!overview ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : overview.budgets.length === 0 ? (
              <Link to="/ledger-stats" className="text-sm text-muted-foreground underline">{t('home_set_budget')}</Link>
            ) : (
              <BudgetBars budgets={overview.budgets.slice(0, 4)} totals={overview.totals} t={t} compact />
            )}
          </CardContent>
        </Card>

        {/* 30 天內的紀念日與好友生日(沒有就不顯示) */}
        {upcoming.length > 0 && (
          <Card className="relative z-10 border-none" style={tint('var(--module-calendar)')}>
            <CardContent className="p-4 md:p-5">
              <CardTitle Icon={Heart} color="var(--module-calendar)" title={t('sub_anniversaries')} to="/anniversaries" />
              <ul className="space-y-1.5">
                {upcoming.slice(0, 4).map((u) => (
                  <li key={u.key} className="flex items-center gap-2 text-sm">
                    <span className="flex w-5 shrink-0 justify-center">{u.icon}</span>
                    <span className="truncate">{u.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{u.days === 0 ? t('home_today') : `${u.days}${t('home_days_left')}`}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 墨箋絮語:只顯示未完成的項目 */}
        <HomeNotesCard t={t} style={tint('var(--module-notes)')} />

        {/* 小紙條 */}
        <HomeSlipsCard t={t} style={tint('var(--module-recurring)')} />
      </div>
    </div>
  );
}

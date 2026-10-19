import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Calendar, Megaphone, PiggyBank, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import BudgetBars from '../components/BudgetBars';
import { monthTotals, loadRates, ymd } from '../lib/budget';
import { useAnnStatus, dismissAnnBanner } from '../lib/annStatus';
import { moodEmoji } from '../lib/moods';
import { usePlan } from '../context/PlanContext';
import { PlanBanner } from '../components/PlanNotice';
import HomeNotesCard from '../components/HomeNotesCard';

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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const { banner } = useAnnStatus();
  const { can } = usePlan();
  const [overview, setOverview] = useState(null); // { events, totals, budgets }
  const [mood, setMood] = useState(null);
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

  const displayName = profile?.username || profile?.email?.split('@')[0] || '';

  return (
    <div className="relative mx-auto max-w-xl px-4 pt-4 pb-40 md:max-w-5xl md:px-8 md:py-10">
      {/* 浮水印插圖 — 放大 3 倍、更淡,拿掉外層 overflow-hidden 避免被裁切 */}
{profileLoaded && !profile?.home_image && (
  <img
    src="/home-watermark-logo.png"
    alt=""
    className="pointer-events-none fixed z-0 bottom-[calc(88px+env(safe-area-inset-bottom))] right-5 w-[280px] opacity-[0.09] md:absolute md:bottom-[-30px] md:right-[-8px] md:w-[340px]"
    style={{ maxWidth: 'none' }}
  />
)}

      <h1 className="page-title-row page-title mb-1 font-semibold" style={{ fontSize: '18.5px' }}>{t('nav_home')}</h1>
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

      {/* 角色放大,下緣約 2/5 壓在「今日行程」卡片上(負 margin = 40% 圖高 + 原本的間距) */}
      <div className="mb-3 flex items-end gap-[64px] md:mb-5 md:gap-[92px]">
        <div className="min-w-0 pb-1">
          <p className="text-muted-foreground" style={{ fontSize: '15.4px' }}>
            {new Intl.DateTimeFormat(t('home_date_locale'), { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}
          </p>
          {displayName && (
            <p className="mt-0.5 text-muted-foreground" style={{ fontSize: '15.4px' }}>{t('home_welcome_prefix')}{displayName}{t('home_welcome_suffix')}</p>
          )}
        </div>
        {profile?.home_image && (
          <div className="pointer-events-none relative z-20 -mb-[63px] shrink-0 md:-mb-[84px]">
            <img src={profile.home_image} alt="" className="h-32 w-auto md:h-40" style={{ maxWidth: 'none' }} />
            {mood && can('mood') && (
              <span className="absolute -left-2 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-base shadow-sm">
                {moodEmoji(mood)}
              </span>
            )}
          </div>
        )}
      </div>

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
            <CardTitle Icon={Wallet} color="var(--module-transactions)" title={t('home_month_spend')} to="/transactions" />
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
            <CardTitle Icon={PiggyBank} color="var(--module-recurring)" title={t('home_budget')} to="/ledger-stats" />
            {!overview ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : overview.budgets.length === 0 ? (
              <Link to="/ledger-stats" className="text-sm text-muted-foreground underline">{t('home_set_budget')}</Link>
            ) : (
              <BudgetBars budgets={overview.budgets.slice(0, 4)} totals={overview.totals} t={t} compact />
            )}
          </CardContent>
        </Card>

        {/* 墨箋絮語:只顯示未完成的項目 */}
        <HomeNotesCard t={t} style={tint('var(--module-notes)')} />
      </div>
    </div>
  );
}

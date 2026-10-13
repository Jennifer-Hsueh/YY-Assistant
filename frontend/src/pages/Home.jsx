import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Calendar, Megaphone, PiggyBank, CloudSun, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import BudgetBars from '../components/BudgetBars';
import { monthTotals, loadRates, ymd } from '../lib/budget';

const MOODS = [
  { key: 'sunny', emoji: '☀️' },
  { key: 'cloudy', emoji: '⛅' },
  { key: 'rainy', emoji: '🌧️' },
  { key: 'storm', emoji: '⛈️' },
  { key: 'rainbow', emoji: '🌈' },
];

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
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnn, setLoadingAnn] = useState(true);
  const [profile, setProfile] = useState(null);
  const [homeImgH, setHomeImgH] = useState(0);
  const [overview, setOverview] = useState(null); // { events, totals, budgets }
  const [mood, setMood] = useState(null);
  const todayKey = ymd(new Date());

  // 今日總覽:今日行程、本月消費、預算、本日心情
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
          totals: monthTotals(transactions, accounts, rates, todayKey.slice(0, 7)),
          budgets,
        });
        setMood(moods[0]?.mood || null);
      } catch (err) {
        console.error(err);
        setOverview({ events: [], totals: { expense: 0, income: 0, byCategory: {} }, budgets: [] });
      }
    }
    loadOverview();
    window.addEventListener('yy:data-changed', loadOverview);
    return () => window.removeEventListener('yy:data-changed', loadOverview);
  }, []);

  async function pickMood(key) {
    const next = mood === key ? null : key;
    setMood(next);
    try { await api.setMood(todayKey, next); } catch (err) { console.error(err); }
  }

  const timeOf = (iso) => {
    const d = new Date(iso);
    return d.getHours() === 0 && d.getMinutes() === 0 ? t('home_all_day') : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    async function load() {
      try {
        const [{ announcements }, { profile }] = await Promise.all([
          api.listAnnouncements(),
          api.getProfile(),
        ]);
        setAnnouncements(announcements.slice(0, 4));
        setProfile(profile);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAnn(false);
      }
    }
    load();
  }, []);

  const displayName = profile?.username || profile?.email?.split('@')[0] || '';

  return (
    <div className="relative mx-auto max-w-xl px-4 pt-4 pb-24 md:max-w-5xl md:px-8 md:py-10">
      {/* 浮水印插圖 — 放大 3 倍、更淡,拿掉外層 overflow-hidden 避免被裁切 */}
{!loadingAnn && !profile?.home_image && (
  <img
    src="/home-watermark-logo.png"
    alt=""
    className="pointer-events-none fixed z-0 bottom-[calc(88px+env(safe-area-inset-bottom))] right-5 w-[280px] opacity-[0.09] md:absolute md:bottom-[-30px] md:right-[-8px] md:w-[340px]"
    style={{ maxWidth: 'none' }}
  />
)}

      <h1 className="page-title-row page-title mb-1 font-semibold" style={{ fontSize: '18.5px' }}>{t('nav_home')}</h1>
      {displayName && (
        <p className="mb-3 text-muted-foreground md:mb-5" style={{ fontSize: '15.4px' }}>{t('home_welcome_prefix')}{displayName}{t('home_welcome_suffix')}</p>
      )}

      <Link to="/announcements" className="relative z-10 mb-3 block md:mb-5">
        <Card
          className="border-none"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, color-mix(in srgb, var(--module-recurring) 12%, var(--card)) 50%, transparent), color-mix(in srgb, color-mix(in srgb, var(--module-recurring) 32%, var(--card)) 50%, transparent))` }}
        >
          <CardContent className="p-3 md:p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[1.3125rem] font-medium" style={{ color: 'var(--module-recurring)' }}>
              <Megaphone className="h-4 w-4" />
              {t('ann_latest')}
            </p>
            {loadingAnn ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : announcements.length === 0 ? (
              <p className="text-[0.975rem] text-muted-foreground">{t('ann_empty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {announcements.map((a) => (
                  <li key={a.id} className="truncate text-xs text-foreground">
                    <span className="text-muted-foreground">{a.published_at.slice(0, 10)}</span> · {a.title}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Link>

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
                  {t('home_month_income')} {Math.round(overview.totals.income).toLocaleString()}
                  {' · '}{t('home_month_balance')} {Math.round(overview.totals.income - overview.totals.expense).toLocaleString()}
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

        {/* 本日心情 */}
        <Card className="relative z-10 border-none" style={tint('var(--module-accounts)')}>
          <CardContent className="p-4 md:p-5">
            <CardTitle Icon={CloudSun} color="var(--module-accounts)" title={t('home_mood')} />
            <div className="flex justify-between gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  aria-label={t(`cm_mood_${m.key}`)}
                  onClick={() => pickMood(m.key)}
                  className={`flex-1 rounded-xl border py-2 text-2xl leading-none transition-all ${mood === m.key ? 'scale-105 border-foreground bg-card shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
            <Link to="/community" className="mt-3 inline-block text-xs text-muted-foreground underline">{t('home_mood_share')}</Link>
          </CardContent>
        </Card>
      </div>
      {!loadingAnn && profile?.home_image && (
        <img
          src={profile.home_image}
          alt=""
          onLoad={(e) => setHomeImgH(e.currentTarget.offsetHeight)}
          className="pointer-events-none relative z-20 ml-auto block w-[280px] opacity-[0.63]"
          style={{ maxWidth: 'none', width: 'auto', height: '220px', marginTop: -homeImgH / 3 }}
        />
      )}
    </div>
  );
}

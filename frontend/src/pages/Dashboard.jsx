import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, PiggyBank, CalendarDays, Feather, Coffee } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';

export default function Dashboard() {
  const { t } = useLanguage();
  const [monthSpending, setMonthSpending] = useState(null);
  const [monthIncome, setMonthIncome] = useState(null);
  const [totalBalance, setTotalBalance] = useState(null);
  const [todayEvents, setTodayEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      try {
        const [{ transactions: expenses }, { transactions: income }, { events }, { accounts }] = await Promise.all([
          api.listTransactions({ from: monthStart, type: 'expense' }),
          api.listTransactions({ from: monthStart, type: 'income' }),
          api.listEvents({ from: todayStart, to: todayEnd }),
          api.listAccounts(),
        ]);
        setMonthSpending(expenses.reduce((sum, t) => sum + Number(t.amount), 0));
        setMonthIncome(income.reduce((sum, t) => sum + Number(t.amount), 0));
        setTotalBalance(accounts.reduce((sum, a) => sum + Number(a.balance), 0));
        setTodayEvents(events);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="relative mx-auto max-w-xl px-4 py-6 pb-24">
      {/* 紙膠帶裝飾 */}
      <div
        className="absolute -top-1 right-8 h-5 w-16 -rotate-3 rounded-sm"
        style={{ backgroundColor: 'color-mix(in oklab, var(--income) 60%, transparent)' }}
      />
      {/* 裝飾插圖 — 放在卡片外的空白處,不影響內容判讀 */}
      <Feather className="pointer-events-none absolute left-1 top-16 h-9 w-9 -rotate-12 opacity-[0.08]" style={{ color: 'var(--ink)' }} />
      <Coffee className="pointer-events-none absolute bottom-2 right-1 h-10 w-10 rotate-6 opacity-[0.08]" style={{ color: 'var(--expense)' }} />

      <h1 className="mb-4 text-lg font-semibold">{t('overview')}</h1>

      {/* 本月支出 — 標頭維持飽和的記帳模組色,底色改漸層 */}
      <Card
        className="mb-3 border-none"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--module-transactions) 6%, white), color-mix(in srgb, var(--module-transactions) 24%, white))' }}
      >
        <CardContent className="p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs" style={{ color: 'var(--module-transactions)' }}>
            <Wallet className="h-3.5 w-3.5" />
            {t('month_expense')}
          </p>
          <p className="font-amount text-2xl font-semibold" style={{ color: 'var(--module-transactions)' }}>
            {loading ? '…' : `NT$ ${monthSpending?.toLocaleString() ?? 0}`}
          </p>
        </CardContent>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card
          className="border-none"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--income) 6%, white), color-mix(in srgb, var(--income) 22%, white))' }}
        >
          <CardContent className="p-3">
            <p className="mb-1 flex items-center gap-1 text-[11px]" style={{ color: 'var(--income)' }}>
              <TrendingUp className="h-3 w-3" />
              {t('month_income')}
            </p>
            <p className="font-amount text-base" style={{ color: 'var(--income)' }}>
              {loading ? '…' : `NT$ ${monthIncome?.toLocaleString() ?? 0}`}
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-none"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--module-accounts) 6%, white), color-mix(in srgb, var(--module-accounts) 22%, white))' }}
        >
          <CardContent className="p-3">
            <p className="mb-1 flex items-center gap-1 text-[11px]" style={{ color: 'var(--module-accounts)' }}>
              <PiggyBank className="h-3 w-3" />
              {t('total_balance')}
            </p>
            <p className="font-amount text-base" style={{ color: 'var(--module-accounts)' }}>
              {loading ? '…' : `NT$ ${totalBalance?.toLocaleString() ?? 0}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card
        className="border-none"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--module-calendar) 5%, white), color-mix(in srgb, var(--module-calendar) 16%, white))' }}
      >
        <CardContent className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm" style={{ color: 'var(--module-calendar)' }}>
            <CalendarDays className="h-4 w-4" />
            {t('today_events')}
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : todayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('no_events_today')}</p>
          ) : (
            <ul className="space-y-2">
              {todayEvents.map((ev) => (
                <li key={ev.id} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ev.color || '#9CA3AF' }} />
                  {ev.title}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

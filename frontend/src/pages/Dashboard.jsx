import { useEffect, useState } from 'react';
import { LogOut, Wallet, TrendingUp, PiggyBank, CalendarDays } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export default function Dashboard() {
  const { user, logout } = useAuth();
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
      <div
        className="absolute -top-1 right-8 h-5 w-16 -rotate-3 rounded-sm"
        style={{ backgroundColor: 'color-mix(in oklab, var(--income) 60%, transparent)' }}
      />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">儀表板</h1>
          {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground">
          <LogOut className="h-4 w-4" />
          登出
        </Button>
      </div>

      {/* 本月支出 — 呼應「記帳」模組色 */}
      <Card className="mb-3 border-l-4" style={{ borderLeftColor: 'var(--module-transactions)' }}>
        <CardContent className="p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" style={{ color: 'var(--module-transactions)' }} />
            本月支出
          </p>
          <p className="font-mono text-2xl font-semibold" style={{ color: 'var(--module-transactions)' }}>
            {loading ? '…' : `NT$ ${monthSpending?.toLocaleString() ?? 0}`}
          </p>
        </CardContent>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-3">
        {/* 本月收入 — 呼應「記帳」模組色系裡的收入色 */}
        <Card className="border-l-4" style={{ borderLeftColor: 'var(--income)' }}>
          <CardContent className="p-3">
            <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" style={{ color: 'var(--income)' }} />
              本月收入
            </p>
            <p className="font-mono text-base" style={{ color: 'var(--income)' }}>
              {loading ? '…' : `NT$ ${monthIncome?.toLocaleString() ?? 0}`}
            </p>
          </CardContent>
        </Card>

        {/* 總餘額 — 呼應「帳戶」模組色 */}
        <Card className="border-l-4" style={{ borderLeftColor: 'var(--module-accounts)' }}>
          <CardContent className="p-3">
            <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <PiggyBank className="h-3 w-3" style={{ color: 'var(--module-accounts)' }} />
              總餘額
            </p>
            <p className="font-mono text-base" style={{ color: 'var(--module-accounts)' }}>
              {loading ? '…' : `NT$ ${totalBalance?.toLocaleString() ?? 0}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 今日行程 — 呼應「行事曆」模組色 */}
      <Card className="border-l-4" style={{ borderLeftColor: 'var(--module-calendar)' }}>
        <CardContent className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" style={{ color: 'var(--module-calendar)' }} />
            今日行程
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : todayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">今天沒有安排的行程</p>
          ) : (
            <ul className="space-y-2">
              {todayEvents.map((ev) => (
                <li key={ev.id} className="flex items-center gap-2 text-sm">
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

import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [monthSpending, setMonthSpending] = useState(null);
  const [todayEvents, setTodayEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      try {
        const [{ transactions }, { events }] = await Promise.all([
          api.listTransactions({ from: monthStart, type: 'expense' }),
          api.listEvents({ from: todayStart, to: todayEnd }),
        ]);
        const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        setMonthSpending(total);
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
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
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
      <Card className="mb-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">本月支出</p>
          <p className="mt-1 text-2xl font-semibold">{loading ? '…' : `NT$ ${monthSpending?.toLocaleString() ?? 0}`}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm text-muted-foreground">今日行程</p>
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

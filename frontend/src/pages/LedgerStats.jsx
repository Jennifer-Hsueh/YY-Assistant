import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import LedgerSubNav from '../components/LedgerSubNav';

const TRANSFER = '轉帳';

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function localDate(iso) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fmt(v) {
  return v == null ? '—' : Math.round(v).toLocaleString();
}

export default function LedgerStats() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rates, setRates] = useState({ TWD: 1 });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => monthKey(new Date()));

  const today = localDate(new Date().toISOString());
  const [filters, setFilters] = useState({
    from: `${today.slice(0, 7)}-01`,
    to: today,
    type: 'expense',
    accountId: 'all',
    category: 'all',
    keyword: '',
    groupBy: 'category',
  });
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      try {
        const [{ transactions }, { accounts }, { categories }] = await Promise.all([
          api.listTransactions(),
          api.listAccounts(),
          api.listCategories(),
        ]);
        setTransactions(transactions);
        setAccounts(accounts);
        setCategories(categories.filter((c) => c.type !== 'event'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const currencies = [...new Set(accounts.map((a) => a.currency || 'TWD'))].filter((c) => c !== 'TWD');
    if (currencies.length === 0) return;
    Promise.all(
      currencies.map((c) =>
        api.getExchangeRate(c, 'TWD')
          .then(({ rate }) => [c, rate])
          .catch(() => [c, null])
      )
    ).then((pairs) => setRates((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
  }, [accounts]);

  const currencyOf = (accountId) => accounts.find((a) => a.id === accountId)?.currency || 'TWD';
  const accountName = (accountId) => accounts.find((a) => a.id === accountId)?.name || t('tx_unspecified_account');
  const rateOf = (tx) => rates[currencyOf(tx.account_id)];
  const toTwd = (tx) => Number(tx.amount) * (rateOf(tx) ?? 0);

  function shiftMonth(delta) {
    const [y, m] = month.split('-').map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  }

  // 月份收支總覽
  const monthTx = useMemo(
    () => transactions.filter((tx) => localDate(tx.occurred_at).slice(0, 7) === month && tx.category !== TRANSFER),
    [transactions, month]
  );
  const monthReady = monthTx.every((tx) => rateOf(tx) != null);
  const income = monthReady ? monthTx.filter((tx) => tx.type === 'income').reduce((s, tx) => s + toTwd(tx), 0) : null;
  const expense = monthReady ? monthTx.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + toTwd(tx), 0) : null;
  const balance = monthReady ? income - expense : null;

  // 條件分析
  const filtered = transactions.filter((tx) => {
    if (tx.category === TRANSFER) return false;
    if (tx.type !== filters.type) return false;
    const d = localDate(tx.occurred_at);
    if (filters.from && d < filters.from) return false;
    if (filters.to && d > filters.to) return false;
    if (filters.accountId !== 'all' && tx.account_id !== filters.accountId) return false;
    if (filters.category !== 'all' && (tx.category || '') !== filters.category) return false;
    if (filters.keyword && !(tx.note || '').toLowerCase().includes(filters.keyword.toLowerCase())) return false;
    return true;
  });
  const filteredReady = filtered.every((tx) => rateOf(tx) != null);
  const total = filteredReady ? filtered.reduce((s, tx) => s + toTwd(tx), 0) : null;

  const groupKey = (tx) => {
    if (filters.groupBy === 'account') return accountName(tx.account_id);
    if (filters.groupBy === 'month') return localDate(tx.occurred_at).slice(0, 7);
    return tx.category || t('tx_no_category');
  };
  const groups = filteredReady
    ? Object.entries(
        filtered.reduce((acc, tx) => {
          const k = groupKey(tx);
          acc[k] ||= { amount: 0, count: 0 };
          acc[k].amount += toTwd(tx);
          acc[k].count += 1;
          return acc;
        }, {})
      ).sort((a, b) => (filters.groupBy === 'month' ? a[0].localeCompare(b[0]) : b[1].amount - a[1].amount))
    : [];
  const barColor = filters.type === 'income' ? '#16a34a' : 'var(--module-transactions)';

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <h1 className="mb-3 text-lg font-semibold">{t('sub_stats')}</h1>
      <LedgerSubNav />

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
                  <p className="text-xs text-muted-foreground">{t('stats_income')}</p>
                  <p className="mt-1 font-amount text-lg font-semibold text-green-600">{fmt(income)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('stats_expense')}</p>
                  <p className="mt-1 font-amount text-lg font-semibold">{fmt(expense)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('stats_balance')}</p>
                  <p className={`mt-1 font-amount text-lg font-semibold ${balance != null && balance < 0 ? 'text-red-500' : ''}`}>{fmt(balance)}</p>
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
                    <Select value={filters.type} onValueChange={(v) => setFilter('type', v)}>
                      <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">{t('type_expense')}</SelectItem>
                        <SelectItem value="income">{t('type_income')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filters.groupBy} onValueChange={(v) => setFilter('groupBy', v)}>
                      <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">{t('stats_group_category')}</SelectItem>
                        <SelectItem value="account">{t('stats_group_account')}</SelectItem>
                        <SelectItem value="month">{t('stats_group_month')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Select value={filters.accountId} onValueChange={(v) => setFilter('accountId', v)}>
                      <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('stats_all_accounts')}</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filters.category} onValueChange={(v) => setFilter('category', v)}>
                      <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('stats_all_categories')}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="text" placeholder={t('stats_keyword')} value={filters.keyword} onChange={(e) => setFilter('keyword', e.target.value)} />
                </div>

                <div className="pt-2 md:pt-0">
                  <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
                    <span className="text-sm text-muted-foreground">{t('stats_total')} · {filtered.length}{t('stats_count_suffix')}</span>
                    <span className={`font-amount text-xl font-semibold ${filters.type === 'income' ? 'text-green-600' : ''}`}>TWD {fmt(total)}</span>
                  </div>
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('stats_no_match')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {groups.map(([name, g]) => {
                        const pct = total ? (g.amount / total) * 100 : 0;
                        return (
                          <li key={name}>
                            <div className="mb-1 flex items-baseline justify-between text-sm">
                              <span>{name}<span className="ml-1.5 text-xs text-muted-foreground">{g.count}{t('stats_count_suffix')}</span></span>
                              <span className="font-amount">
                                {fmt(g.amount)}
                                <span className="ml-2 inline-block w-12 text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted">
                              <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
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

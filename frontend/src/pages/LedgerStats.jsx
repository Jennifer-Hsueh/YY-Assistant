import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import LedgerSubNav from '../components/LedgerSubNav';
import BudgetBars from '../components/BudgetBars';
import { Button } from '../components/ui/button';
import { X } from 'lucide-react';
import { monthTotals } from '../lib/budget';

const TRANSFER = '轉帳';
const BALANCE_ADJUST = '餘額調整'; // 帳戶餘額調整,不算收支

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
  // 手機版:條件分析點了才展開
  const [customOpen, setCustomOpen] = useState(false);
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

  // 每月預算
  const [budgets, setBudgets] = useState([]);
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  useEffect(() => {
    api.listBudgets().then(({ budgets }) => setBudgets(budgets)).catch((err) => console.error(err));
  }, []);
  async function saveBudget(e) {
    e.preventDefault();
    if (!(Number(budgetAmount) > 0)) return;
    try {
      const { budget } = await api.saveBudget({ category: budgetCategory, amount: Number(budgetAmount) });
      setBudgets((prev) => [...prev.filter((b) => b.category !== budget.category), budget]);
      setBudgetAmount('');
    } catch (err) {
      console.error(err);
    }
  }
  async function removeBudget(id) {
    try {
      await api.deleteBudget(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

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
    () => transactions.filter((tx) => localDate(tx.occurred_at).slice(0, 7) === month && tx.category !== TRANSFER && tx.category !== BALANCE_ADJUST),
    [transactions, month]
  );
  const monthReady = monthTx.every((tx) => rateOf(tx) != null);
  const income = monthReady ? monthTx.filter((tx) => tx.type === 'income').reduce((s, tx) => s + toTwd(tx), 0) : null;
  const expense = monthReady ? monthTx.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + toTwd(tx), 0) : null;
  const balance = monthReady ? income - expense : null;

  // 條件分析
  const filtered = transactions.filter((tx) => {
    if (tx.category === TRANSFER || tx.category === BALANCE_ADJUST) return false;
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
  const barColor = filters.type === 'income' ? 'var(--color-green-600)' : 'var(--module-transactions)';

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('sub_stats')}</h1>
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

          <Card className="mb-4">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium">{t('budget_title')} <span className="ml-1 font-amount text-xs font-normal text-muted-foreground">{month}</span></p>
              <div className="md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-6">
                <div className="mb-4 md:mb-0">
                  {budgets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('budget_empty')}</p>
                  ) : (
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <BudgetBars budgets={budgets} totals={monthTotals(transactions, accounts, rates, month)} t={t} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <form onSubmit={saveBudget} className="flex gap-2">
                    <Select value={budgetCategory || 'total'} onValueChange={(v) => setBudgetCategory(v === 'total' ? '' : v)}>
                      <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total">{t('budget_total')}</SelectItem>
                        {categories.filter((c) => c.type !== 'income').map((c) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" inputMode="decimal" min="1" placeholder={t('budget_amount_placeholder')} value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className="min-w-0 flex-1" />
                    <Button type="submit" disabled={!(Number(budgetAmount) > 0)}>{t('budget_add')}</Button>
                  </form>
                  {budgets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {[...budgets].sort((a, b) => (a.category === '' ? -1 : b.category === '' ? 1 : a.category.localeCompare(b.category))).map((b) => (
                        <span key={b.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                          {b.category === '' ? t('budget_total') : b.category} {Number(b.amount).toLocaleString()}
                          <button type="button" aria-label="remove" onClick={() => removeBudget(b.id)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <button type="button" onClick={() => setCustomOpen((o) => !o)} className="flex w-full items-center justify-between text-left text-sm font-medium md:pointer-events-none md:mb-3">
                {t('stats_custom')}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform md:hidden ${customOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`space-y-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6 md:space-y-0 ${customOpen ? 'mt-3 md:mt-0' : 'hidden'}`}>
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

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import LedgerSubNav from '../components/LedgerSubNav';

const TRANSFER = '轉帳';

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(v) {
  return v == null ? '—' : Math.round(v).toLocaleString();
}

export default function LedgerStats() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [rates, setRates] = useState({ TWD: 1 });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => monthKey(new Date()));

  useEffect(() => {
    async function load() {
      try {
        const [{ transactions }, { accounts }] = await Promise.all([
          api.listTransactions(),
          api.listAccounts(),
        ]);
        setTransactions(transactions);
        setAccounts(accounts);
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

  function currencyOf(accountId) {
    return accounts.find((a) => a.id === accountId)?.currency || 'TWD';
  }

  function shiftMonth(delta) {
    const [y, m] = month.split('-').map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  }

  const monthTx = useMemo(
    () => transactions.filter((tx) => tx.occurred_at.slice(0, 7) === month && tx.category !== TRANSFER),
    [transactions, month]
  );

  const ratesReady = monthTx.every((tx) => rates[currencyOf(tx.account_id)] != null);
  const toTwd = (tx) => Number(tx.amount) * (rates[currencyOf(tx.account_id)] ?? 0);

  const income = ratesReady ? monthTx.filter((tx) => tx.type === 'income').reduce((s, tx) => s + toTwd(tx), 0) : null;
  const expense = ratesReady ? monthTx.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + toTwd(tx), 0) : null;
  const balance = ratesReady ? income - expense : null;

  const byCategory = ratesReady
    ? Object.entries(
        monthTx
          .filter((tx) => tx.type === 'expense')
          .reduce((acc, tx) => {
            const key = tx.category || t('tx_no_category');
            acc[key] = (acc[key] || 0) + toTwd(tx);
            return acc;
          }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  const byAccount = Object.values(
    monthTx.reduce((acc, tx) => {
      const id = tx.account_id || 'none';
      const name = accounts.find((a) => a.id === tx.account_id)?.name || t('tx_unspecified_account');
      acc[id] ||= { name, currency: currencyOf(tx.account_id), income: 0, expense: 0 };
      acc[id][tx.type] += Number(tx.amount);
      return acc;
    }, {})
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <h1 className="mb-3 text-lg font-semibold">{t('sub_stats')}</h1>
      <LedgerSubNav />

      <div className="mb-4 flex items-center justify-center gap-4">
        <button type="button" onClick={() => shiftMonth(-1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-amount text-base font-medium">{month}</span>
        <button type="button" onClick={() => shiftMonth(1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="grid grid-cols-3 gap-2 p-4 text-center">
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
            </CardContent>
          </Card>

          <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
            <Card>
              <CardContent className="p-4">
                <p className="mb-3 text-sm font-medium">{t('stats_by_category')}</p>
                {byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('stats_no_data')}</p>
                ) : (
                  <ul className="space-y-3">
                    {byCategory.map(([name, amount]) => {
                      const pct = expense ? (amount / expense) * 100 : 0;
                      return (
                        <li key={name}>
                          <div className="mb-1 flex items-baseline justify-between text-sm">
                            <span>{name}</span>
                            <span className="font-amount">
                              {fmt(amount)}
                              <span className="ml-2 inline-block w-12 text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--module-transactions)' }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="mb-3 text-sm font-medium">{t('stats_by_account')}</p>
                {byAccount.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('stats_no_data')}</p>
                ) : (
                  <div className="divide-y divide-border">
                    {byAccount.map((row) => (
                      <div key={row.name} className="flex items-center justify-between py-2 text-sm">
                        <span>{row.name}</span>
                        <span className="font-amount text-right">
                          <span className="text-green-600">+{row.income.toLocaleString()}</span>
                          <span className="mx-1 text-muted-foreground">/</span>
                          <span>-{row.expense.toLocaleString()}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{row.currency}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

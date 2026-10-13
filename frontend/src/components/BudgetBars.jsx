// 預算使用進度條:總預算排第一,80% 以上變色,超過 100% 用警示色
export default function BudgetBars({ budgets, totals, t, compact = false }) {
  const sorted = [...budgets].sort((a, b) => (a.category === '' ? -1 : b.category === '' ? 1 : a.category.localeCompare(b.category)));
  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {sorted.map((b) => {
        const spent = b.category === '' ? totals.expense : totals.byCategory[b.category] || 0;
        const ratio = spent / Number(b.amount);
        const color = ratio >= 1 ? 'var(--destructive)' : ratio >= 0.8 ? 'var(--highlight)' : 'var(--primary)';
        return (
          <div key={b.id || b.category}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className={b.category === '' ? 'font-medium' : ''}>{b.category === '' ? t('budget_total') : b.category}</span>
              <span className="font-amount text-muted-foreground">
                <span style={{ color: ratio >= 0.8 ? color : undefined }}>{Math.round(ratio * 100)}%</span>
                {' · '}{Math.round(spent).toLocaleString()} / {Number(b.amount).toLocaleString()}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

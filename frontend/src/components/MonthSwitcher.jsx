import { ChevronLeft, ChevronRight } from 'lucide-react';

// 月份切換:‹ 2026 年 10 月 ›,點中間回到本月
export default function MonthSwitcher({ month, onChange, t, className = '' }) {
  const now = new Date();
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const shift = (n) => onChange(new Date(month.getFullYear(), month.getMonth() + n, 1));
  return (
    <div className={`flex items-center justify-between rounded-lg border border-border bg-card px-1 py-1 text-sm shadow-sm ${className}`}>
      <button type="button" aria-label="prev month" onClick={() => shift(-1)} className="rounded-md p-1.5 hover:bg-muted">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange(new Date(now.getFullYear(), now.getMonth(), 1))}
        className="font-amount font-medium"
        title={t('month_this')}
      >
        {month.getFullYear()} / {String(month.getMonth() + 1).padStart(2, '0')}
        {!isCurrent && <span className="ml-2 text-xs font-normal text-muted-foreground underline">{t('month_this')}</span>}
      </button>
      <button type="button" aria-label="next month" onClick={() => shift(1)} className="rounded-md p-1.5 hover:bg-muted">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

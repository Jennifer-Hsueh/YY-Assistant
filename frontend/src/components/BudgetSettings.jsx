import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { usePlan } from '../context/PlanContext';
import { askUpgrade } from './PlanNotice';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

// 每月預算的設定(帳戶管理裡):總預算或依分類,同一個分類再設定一次會覆蓋
export default function BudgetSettings({ t }) {
  const { can } = usePlan();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    api.listBudgets().then(({ budgets }) => setBudgets(budgets)).catch((err) => console.error(err));
    api.listCategories().then(({ categories }) => setCategories(categories.filter((c) => c.type !== 'event' && c.type !== 'income'))).catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault();
    if (!can('ledger')) { askUpgrade('ledger'); return; }
    if (!(Number(amount) > 0)) return;
    try {
      const { budget } = await api.saveBudget({ category, amount: Number(amount) });
      setBudgets((prev) => [...prev.filter((b) => b.category !== budget.category), budget]);
      setAmount('');
      window.dispatchEvent(new Event('yy:data-changed'));
    } catch (err) {
      console.error(err);
    }
  }
  async function remove(id) {
    if (!can('ledger')) { askUpgrade('ledger'); return; }
    try {
      await api.deleteBudget(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      window.dispatchEvent(new Event('yy:data-changed'));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('budget_title')}</p>
      <form onSubmit={save} className="flex gap-2">
        <Select value={category || 'total'} onValueChange={(v) => setCategory(v === 'total' ? '' : v)}>
          <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="total">{t('budget_total')}</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="number" inputMode="decimal" min="1" placeholder={t('budget_amount_placeholder')} value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 flex-1" />
        <Button type="submit" disabled={!(Number(amount) > 0)}>{t('budget_add')}</Button>
      </form>
      <p className="text-xs text-muted-foreground">{t('budget_hint')}</p>
      {budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('budget_empty')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {[...budgets].sort((a, b) => (a.category === '' ? -1 : b.category === '' ? 1 : a.category.localeCompare(b.category))).map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
              {b.category === '' ? t('budget_total') : b.category} {Number(b.amount).toLocaleString()}
              <button type="button" aria-label="remove" onClick={() => remove(b.id)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

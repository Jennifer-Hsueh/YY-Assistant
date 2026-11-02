import { useEffect, useState } from 'react';
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
  const [editing, setEditing] = useState(null); // { id, amount }
  const [deleting, setDeleting] = useState(null); // 要刪除的 id

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
  async function saveEdit(b) {
    if (!can('ledger')) { askUpgrade('ledger'); return; }
    const n = Number(editing?.amount);
    if (!(n > 0)) return;
    try {
      const { budget } = await api.saveBudget({ category: b.category, amount: n });
      setBudgets((prev) => [...prev.filter((x) => x.category !== budget.category), budget]);
      setEditing(null);
      window.dispatchEvent(new Event('yy:data-changed'));
    } catch (err) {
      console.error(err);
    }
  }
  async function remove(id) {
    setDeleting(null);
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
        <ul className="divide-y divide-border rounded-md border border-border">
          {[...budgets].sort((a, b) => (a.category === '' ? -1 : b.category === '' ? 1 : a.category.localeCompare(b.category))).map((b) => (
            <li key={b.id} className="px-3 py-2 text-sm">
              {editing?.id === b.id ? (
                <form onSubmit={(e) => { e.preventDefault(); saveEdit(b); }} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate">{b.category === '' ? t('budget_total') : b.category}</span>
                  <Input autoFocus type="number" inputMode="decimal" min="1" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} className="h-8 min-w-0 flex-1" />
                  <Button type="submit" size="sm" disabled={!(Number(editing.amount) > 0)}>{t('save')}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
                </form>
              ) : deleting === b.id ? (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">{t('budget_delete_confirm').replace('{name}', b.category === '' ? t('budget_total') : b.category)}</span>
                  <Button type="button" size="sm" variant="destructive" onClick={() => remove(b.id)}>{t('mode_delete')}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDeleting(null)}>{t('cancel')}</Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate">{b.category === '' ? t('budget_total') : b.category}</span>
                  <span className="font-amount">{Number(b.amount).toLocaleString()}</span>
                  <button type="button" onClick={() => { setDeleting(null); setEditing({ id: b.id, amount: String(b.amount) }); }} className="text-xs text-muted-foreground underline">{t('edit_sub_modify')}</button>
                  <button type="button" onClick={() => { setEditing(null); setDeleting(b.id); }} className="text-xs text-muted-foreground underline">{t('mode_delete')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

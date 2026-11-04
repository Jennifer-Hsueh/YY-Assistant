import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import { usePlan } from '../context/PlanContext';
import { askUpgrade } from './PlanNotice';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

// 每月預算(帳戶管理裡):總預算一筆+各分類各自的預算,都可以新增、修改、刪除
// 預算存法:category = '' 是總預算,其他是分類名稱;同一個分類只會有一筆
export default function BudgetSettings({ t }) {
  const { can } = usePlan();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [adding, setAdding] = useState(null); // { category, amount }:新增分類預算 / 設定總預算
  const [editing, setEditing] = useState(null); // { id, category, amount }
  const [deleting, setDeleting] = useState(null); // 要刪除的 id
  const [error, setError] = useState('');

  useEffect(() => {
    api.listBudgets().then(({ budgets }) => setBudgets(budgets)).catch((err) => console.error(err));
    api.listCategories().then(({ categories }) => setCategories(categories.filter((c) => c.type !== 'event' && c.type !== 'income'))).catch(() => {});
  }, []);

  const changed = () => window.dispatchEvent(new Event('yy:data-changed'));
  const allowed = () => { if (!can('ledger')) { askUpgrade('ledger'); return false; } return true; };
  const total = budgets.find((b) => b.category === '');
  const catBudgets = budgets.filter((b) => b.category !== '').sort((a, b) => a.category.localeCompare(b.category, 'zh-Hant'));
  const freeCats = [...new Set(categories.map((c) => c.name))].filter((n) => !budgets.some((b) => b.category === n));
  const nameOf = (b) => (b.category === '' ? t('budget_total') : b.category);

  async function save(category, amount, oldId) {
    if (!allowed()) return false;
    const n = Number(amount);
    if (!(n > 0)) return false;
    setError('');
    try {
      // 改了分類:先刪掉舊的那筆
      const old = oldId ? budgets.find((b) => b.id === oldId) : null;
      if (old && old.category !== category) await api.deleteBudget(old.id);
      const { budget } = await api.saveBudget({ category, amount: n });
      setBudgets((prev) => [...prev.filter((b) => b.category !== budget.category && b.id !== oldId), budget]);
      changed();
      return true;
    } catch (err) {
      console.error(err);
      setError(t('budget_failed'));
      return false;
    }
  }
  async function remove(id) {
    setDeleting(null);
    if (!allowed()) return;
    try {
      await api.deleteBudget(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      changed();
    } catch (err) {
      console.error(err);
      setError(t('budget_failed'));
    }
  }

  const amountInput = (value, onChange) => (
    <Input autoFocus type="number" inputMode="decimal" min="1" placeholder={t('budget_amount_short')} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 min-w-0 flex-1" />
  );

  // 一列預算:顯示/修改/刪除確認(用函式呼叫,不當元件,輸入時才不會失去焦點)
  function renderRow(b) {
    if (editing?.id === b.id) {
      const opts = b.category === '' ? [] : [b.category, ...freeCats];
      return (
        <form onSubmit={async (e) => { e.preventDefault(); if (await save(editing.category, editing.amount, b.id)) setEditing(null); }} className="flex flex-wrap items-center gap-2">
          {b.category === '' ? <span className="w-20 shrink-0">{t('budget_total')}</span> : (
            <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
              <SelectTrigger className="h-8 w-28 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>{opts.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {amountInput(editing.amount, (v) => setEditing({ ...editing, amount: v }))}
          <Button type="submit" size="sm" disabled={!(Number(editing.amount) > 0)}>{t('save')}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
        </form>
      );
    }
    if (deleting === b.id) {
      return (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1">{t('budget_delete_confirm').replace('{name}', nameOf(b))}</span>
          <Button type="button" size="sm" variant="destructive" onClick={() => remove(b.id)}>{t('mode_delete')}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDeleting(null)}>{t('cancel')}</Button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate">{nameOf(b)}</span>
        <span className="font-amount">{Number(b.amount).toLocaleString()}</span>
        <button type="button" onClick={() => { setDeleting(null); setAdding(null); setEditing({ id: b.id, category: b.category, amount: String(b.amount) }); }} className="text-xs text-muted-foreground underline">{t('edit_sub_modify')}</button>
        <button type="button" onClick={() => { setEditing(null); setDeleting(b.id); }} className="text-xs text-muted-foreground underline">{t('mode_delete')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium">{t('budget_title')}</p>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 總預算 */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">{t('budget_total_label')}</p>
        <div className="rounded-md border border-border px-3 py-2">
          {total ? renderRow(total) : adding?.category === '' ? (
            <form onSubmit={async (e) => { e.preventDefault(); if (await save('', adding.amount)) setAdding(null); }} className="flex items-center gap-2">
              <span className="w-20 shrink-0">{t('budget_total')}</span>
              {amountInput(adding.amount, (v) => setAdding({ ...adding, amount: v }))}
              <Button type="submit" size="sm" disabled={!(Number(adding.amount) > 0)}>{t('budget_add')}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setAdding(null)}>{t('cancel')}</Button>
            </form>
          ) : (
            <button type="button" onClick={() => { setEditing(null); setAdding({ category: '', amount: '' }); }} className="flex w-full items-center gap-1.5 text-muted-foreground">
              <Plus className="h-4 w-4" />{t('budget_set_total')}
            </button>
          )}
        </div>
      </div>

      {/* 分類預算 */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">{t('budget_cat_label')}</p>
        <ul className="divide-y divide-border rounded-md border border-border">
          {catBudgets.map((b) => <li key={b.id} className="px-3 py-2">{renderRow(b)}</li>)}
          <li className="px-3 py-2">
            {adding && adding.category !== '' ? (
              <form onSubmit={async (e) => { e.preventDefault(); if (await save(adding.category, adding.amount)) setAdding(null); }} className="flex flex-wrap items-center gap-2">
                <Select value={adding.category || undefined} onValueChange={(v) => setAdding({ ...adding, category: v })}>
                  <SelectTrigger className="h-8 w-28 shrink-0"><SelectValue placeholder={t('budget_pick_cat')} /></SelectTrigger>
                  <SelectContent>{freeCats.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
                {amountInput(adding.amount, (v) => setAdding({ ...adding, amount: v }))}
                <Button type="submit" size="sm" disabled={!adding.category || !(Number(adding.amount) > 0)}>{t('budget_add')}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding(null)}>{t('cancel')}</Button>
              </form>
            ) : freeCats.length ? (
              <button type="button" onClick={() => { setEditing(null); setAdding({ category: null, amount: '' }); }} className="flex w-full items-center gap-1.5 text-muted-foreground">
                <Plus className="h-4 w-4" />{t('budget_add_cat')}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">{t('budget_all_set')}</p>
            )}
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">{t('budget_cat_hint')}</p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

function todayLocal() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function toLocalDateInput(isoString) {
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

const emptyForm = { type: 'expense', amount: '', category: '', note: '', account_id: '', occurred_at: todayLocal() };
const emptyTransfer = { from: '', to: '', amount: '' };

export default function Transactions() {
  const [view, setView] = useState('list');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  // actionMode: 'add' | 'edit' | 'delete' | 'transfer' — controls the top button group
  const [actionMode, setActionMode] = useState('add');
  // activeId: which transaction the user picked from the list (for edit/delete)
  const [activeId, setActiveId] = useState(null);

  const [transfer, setTransfer] = useState(emptyTransfer);
  const [transferError, setTransferError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [{ transactions }, { accounts }, { categories }] = await Promise.all([
        api.listTransactions(),
        api.listAccounts(),
        api.listCategories(),
      ]);
      setTransactions(transactions);
      setAccounts(accounts);
      setCategories(categories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function switchActionMode(newMode) {
    setActionMode(newMode);
    setActiveId(null);
    setForm(emptyForm);
    setTransfer(emptyTransfer);
    setTransferError('');
  }

  function pickTransaction(t) {
    setActiveId(t.id);
    setForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category || '',
      note: t.note || '',
      account_id: t.account_id || '',
      occurred_at: toLocalDateInput(t.occurred_at),
    });
  }

  function resetAfterAction() {
    setForm(emptyForm);
    setActionMode('add');
    setActiveId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount) return;
    const occurredAtIso = new Date(`${form.occurred_at}T12:00:00`).toISOString();
    const payload = {
      type: form.type,
      amount: Number(form.amount),
      category: form.category || null,
      note: form.note || null,
      account_id: form.account_id || null,
      occurred_at: occurredAtIso,
    };

    if (actionMode === 'edit' && activeId) {
      await api.updateTransaction(activeId, payload);
    } else {
      await api.createTransaction(payload);
    }
    resetAfterAction();
    load();
  }

  async function handleConfirmDelete() {
    await api.deleteTransaction(activeId);
    resetAfterAction();
    load();
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setTransferError('');
    if (!transfer.from || !transfer.to || !transfer.amount) return;
    if (transfer.from === transfer.to) {
      setTransferError('轉出與轉入帳戶不能相同');
      return;
    }
    try {
      await api.transferBetweenAccounts({
        from_account_id: transfer.from,
        to_account_id: transfer.to,
        amount: Number(transfer.amount),
      });
      setTransfer(emptyTransfer);
      load();
    } catch (err) {
      console.error(err);
      setTransferError('轉帳失敗,請確認金額與帳戶是否正確');
    }
  }

  const grouped = transactions.reduce((acc, t) => {
    const day = t.occurred_at.slice(0, 10);
    (acc[day] ||= []).push(t);
    return acc;
  }, {});

  function accountName(id) {
    return accounts.find((a) => a.id === id)?.name;
  }

  const pickingMode = (actionMode === 'edit' || actionMode === 'delete') && !activeId;

  // Categories relevant to the currently selected type (支出/收入), plus any 'general' ones.
  const relevantCategories = categories.filter((c) => c.type === form.type || c.type === 'general');

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">記帳</h1>
        <div className="flex rounded-lg bg-muted p-1 text-sm">
          <button onClick={() => setView('list')} className={`rounded-md px-3 py-1 transition-colors ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>列表</button>
          <button onClick={() => setView('calendar')} className={`rounded-md px-3 py-1 transition-colors ${view === 'calendar' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>日曆</button>
        </div>
      </div>

      {/* Action mode switch: 新增 / 編輯 / 刪除 / 轉帳 */}
      <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
        <button
          onClick={() => switchActionMode('add')}
          className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'add' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
        >新增</button>
        <button
          onClick={() => switchActionMode('edit')}
          className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'edit' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
        >編輯</button>
        <button
          onClick={() => switchActionMode('delete')}
          className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'delete' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
        >刪除</button>
        <button
          onClick={() => switchActionMode('transfer')}
          className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${actionMode === 'transfer' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}
        >轉帳</button>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-2 p-4">
          {actionMode === 'transfer' ? (
            <form onSubmit={handleTransfer} className="space-y-2">
              {transferError && <p className="text-sm text-red-500">{transferError}</p>}
              <Select value={transfer.from || 'none'} onValueChange={(v) => setTransfer({ ...transfer, from: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="從哪個帳戶轉出" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">選擇轉出帳戶</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}(NT$ {Number(acc.balance).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={transfer.to || 'none'} onValueChange={(v) => setTransfer({ ...transfer, to: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="轉入哪個帳戶" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">選擇轉入帳戶</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}(NT$ {Number(acc.balance).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" placeholder="轉帳金額" required value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} />
              <Button type="submit" className="w-full">確認轉帳</Button>
            </form>
          ) : pickingMode ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              請從下方列表點選要{actionMode === 'edit' ? '編輯' : '刪除'}的紀錄
            </p>
          ) : actionMode === 'delete' && activeId ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">確定要刪除這筆紀錄嗎?</p>
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                <p>{form.type === 'income' ? '收入' : '支出'} · {form.category || '未分類'} · NT$ {Number(form.amount).toLocaleString()}</p>
                <p>{form.occurred_at}</p>
                {form.note && <p>{form.note}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>確認刪除</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setActiveId(null); setForm(emptyForm); }}>重新選擇</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              {actionMode === 'edit' && activeId && (
                <p className="text-xs font-medium text-muted-foreground">正在編輯這筆紀錄</p>
              )}
              <div className="flex gap-2">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, category: '' })}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">支出</SelectItem>
                    <SelectItem value="income">收入</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="金額" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <Input
                type="date"
                required
                value={form.occurred_at}
                onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
              />
              <Select
                value={form.account_id || 'none'}
                onValueChange={(v) => setForm({ ...form, account_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="選擇帳戶(選填)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定帳戶</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.category || 'none'}
                onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="選擇分類(選填)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定分類</SelectItem>
                  {relevantCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                placeholder="說明(選填,例如:跟同事聚餐)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
              <Link to="/categories" className="block text-right text-xs text-muted-foreground underline">
                管理分類
              </Link>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{actionMode === 'edit' ? '儲存修改' : '新增紀錄'}</Button>
                {actionMode === 'edit' && activeId && (
                  <Button type="button" variant="outline" onClick={() => { setActiveId(null); setForm(emptyForm); }}>重新選擇</Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">載入中…</p>
      ) : view === 'list' ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{day}</p>
              <Card>
                <div className="divide-y divide-border">
                  {items.map((t) => {
                    const selectable = actionMode === 'edit' || actionMode === 'delete';
                    const isActive = activeId === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={selectable ? () => pickTransaction(t) : undefined}
                        className={`flex items-center justify-between px-4 py-2 text-sm ${selectable ? 'cursor-pointer' : ''} ${isActive ? 'bg-muted' : selectable ? 'hover:bg-muted/50' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-xs text-muted-foreground">{accountName(t.account_id) || '未指定帳戶'}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{t.type === 'income' ? '收入' : '支出'}</span>
                            {t.category && (
                              <>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">{t.category}</span>
                              </>
                            )}
                          </div>
                          <p className="truncate">{t.note || '（無說明）'}</p>
                        </div>
                        <span className={`shrink-0 pl-2 ${t.type === 'income' ? 'text-green-600' : 'text-foreground'}`}>{t.type === 'income' ? '+' : '-'}NT$ {Number(t.amount).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">還沒有任何紀錄</p>}
        </div>
      ) : (
        <CalendarView grouped={grouped} />
      )}
    </div>
  );
}

function CalendarView({ grouped }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEntries = !!grouped[dateKey];
            return (
              <div key={idx} className="flex flex-col items-center py-1 text-xs">
                <span>{day}</span>
                {hasEntries && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-foreground" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

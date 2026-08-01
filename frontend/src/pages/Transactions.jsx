import { useEffect, useState } from 'react';
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

export default function Transactions() {
  const [view, setView] = useState('list');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  // mode: 'add' | 'edit' | 'delete'
  const [mode, setMode] = useState('add');
  const [activeId, setActiveId] = useState(null);

  async function load() {
    setLoading(true);
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

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm(emptyForm);
    setMode('add');
    setActiveId(null);
  }

  function selectForEdit(t) {
    setForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category || '',
      note: t.note || '',
      account_id: t.account_id || '',
      occurred_at: toLocalDateInput(t.occurred_at),
    });
    setMode('edit');
    setActiveId(t.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectForDelete(t) {
    setForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category || '',
      note: t.note || '',
      account_id: t.account_id || '',
      occurred_at: toLocalDateInput(t.occurred_at),
    });
    setMode('delete');
    setActiveId(t.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (mode === 'edit') {
      await api.updateTransaction(activeId, payload);
    } else {
      await api.createTransaction(payload);
    }
    resetForm();
    load();
  }

  async function handleConfirmDelete() {
    await api.deleteTransaction(activeId);
    resetForm();
    load();
  }

  const grouped = transactions.reduce((acc, t) => {
    const day = t.occurred_at.slice(0, 10);
    (acc[day] ||= []).push(t);
    return acc;
  }, {});

  function accountName(id) {
    return accounts.find((a) => a.id === id)?.name;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">記帳</h1>
        <div className="flex rounded-lg bg-muted p-1 text-sm">
          <button onClick={() => setView('list')} className={`rounded-md px-3 py-1 transition-colors ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>列表</button>
          <button onClick={() => setView('calendar')} className={`rounded-md px-3 py-1 transition-colors ${view === 'calendar' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>日曆</button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-2 p-4">
          {mode !== 'delete' ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              {mode === 'edit' && (
                <p className="text-xs font-medium text-muted-foreground">正在編輯這筆紀錄</p>
              )}
              <div className="flex gap-2">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
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
              <Input type="text" placeholder="分類(選填)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{mode === 'edit' ? '儲存修改' : '新增紀錄'}</Button>
                {mode === 'edit' && (
                  <Button type="button" variant="outline" onClick={resetForm}>取消</Button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">確定要刪除這筆紀錄嗎?</p>
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                <p>{form.type === 'income' ? '收入' : '支出'} · {form.category || '未分類'} · NT$ {Number(form.amount).toLocaleString()}</p>
                <p>{form.occurred_at}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirmDelete}>確認刪除</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>取消</Button>
              </div>
            </div>
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
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between px-4 py-2 text-sm ${activeId === t.id && mode !== 'add' ? 'bg-muted' : ''}`}
                    >
                      <div>
                        <span>{t.category || (t.type === 'income' ? '收入' : '支出')}</span>
                        {t.account_id && (
                          <span className="ml-2 text-xs text-muted-foreground">({accountName(t.account_id) || '帳戶'})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={t.type === 'income' ? 'text-green-600' : 'text-foreground'}>{t.type === 'income' ? '+' : '-'}NT$ {Number(t.amount).toLocaleString()}</span>
                        <button type="button" onClick={() => selectForEdit(t)} className="text-xs text-muted-foreground underline">編輯</button>
                        <button type="button" onClick={() => selectForDelete(t)} className="text-xs text-red-500 underline">刪除</button>
                      </div>
                    </div>
                  ))}
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

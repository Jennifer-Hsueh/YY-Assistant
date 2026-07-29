import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const CARD_COLORS = ['bg-primary', 'bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600'];

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { accounts } = await api.listAccounts();
      setAccounts(accounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name) return;
    await api.createAccount({ name, balance: 0 });
    setName('');
    load();
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <h1 className="mb-4 text-lg font-semibold">帳戶管理</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">載入中…</p>
      ) : accounts.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">還沒有任何帳戶,先新增一個吧</p>
      ) : (
        <div className="relative mb-6 h-40">
          {accounts.map((acc, idx) => {
            const offset = idx - activeIndex;
            if (Math.abs(offset) > 2) return null;
            return (
              <button
                key={acc.id}
                onClick={() => setActiveIndex(idx)}
                className={`absolute inset-x-0 h-36 rounded-2xl p-4 text-left text-white shadow-lg transition-all ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                style={{ top: `${Math.abs(offset) * 10}px`, transform: `scale(${1 - Math.abs(offset) * 0.05})`, zIndex: 10 - Math.abs(offset), opacity: Math.abs(offset) > 1 ? 0.5 : 1 }}
              >
                <p className="text-sm opacity-80">{acc.name}</p>
                <p className="mt-4 text-2xl font-semibold">NT$ {Number(acc.balance).toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      )}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input type="text" placeholder="新帳戶名稱" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">新增</Button>
      </form>
    </div>
  );
}

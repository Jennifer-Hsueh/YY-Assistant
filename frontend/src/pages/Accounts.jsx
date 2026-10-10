import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import LedgerSubNav from '../components/LedgerSubNav';

const CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'GBP'];

// 沒自訂顏色的帳戶輪流用的預設色(由 index.css 依主題提供)
const CARD_COLORS = ['var(--acc-1)', 'var(--acc-2)', 'var(--acc-3)', 'var(--acc-4)', 'var(--acc-5)'];
// 新增帳戶時可快速點選的顏色
const SWATCHES = ['#33415C', '#6E8B5D', '#C1666B', '#B08238', '#4F46E5', '#0F766E', '#7C3AED', '#475569'];

const cardColor = (acc, idx) => acc.color || CARD_COLORS[idx % CARD_COLORS.length];

function ColorPicker({ value, onChange, t }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{t('acc_color')}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`h-6 rounded-full border border-border px-2 text-xs ${value == null ? 'ring-2 ring-ring ring-offset-1' : 'text-muted-foreground'}`}
        >
          {t('acc_color_auto')}
        </button>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-full ${value?.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-ring ring-offset-1' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={value || '#33415C'}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded-md border border-input"
          title={t('acc_color')}
        />
      </div>
    </div>
  );
}

export default function Accounts() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState('add');

  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState('TWD');
  const [newColor, setNewColor] = useState(null);
  const [editColor, setEditColor] = useState(null);

  const [pickedId, setPickedId] = useState(null);
  const [editName, setEditName] = useState('');
  const [actionError, setActionError] = useState('');
  const [rates, setRates] = useState({ TWD: 1 });

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

  function switchMode(newMode) {
    setMode(newMode);
    setPickedId(null);
    setEditName('');
    setEditColor(null);
    setActionError('');
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName) return;
    await api.createAccount({ name: newName, balance: 0, currency: newCurrency, color: newColor });
    setNewName('');
    setNewColor(null);
    load();
  }

  function pickForEdit(acc) {
    setPickedId(acc.id);
    setEditName(acc.name);
    setEditColor(acc.color || null);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    setActionError('');
    try {
      await api.updateAccount(pickedId, { name: editName.trim(), color: editColor });
      switchMode('edit');
      load();
    } catch (err) {
      console.error(err);
      setActionError(t('acc_update_failed'));
    }
  }

  async function confirmDelete() {
    setActionError('');
    try {
      await api.deleteAccount(pickedId);
      switchMode('delete');
      load();
    } catch (err) {
      console.error(err);
      setActionError(t('acc_delete_failed'));
    }
  }

  const pickingMode = (mode === 'edit' || mode === 'delete') && !pickedId;
  const pickedAccount = accounts.find((a) => a.id === pickedId);

  const subtotals = accounts.reduce((acc, a) => {
    const c = a.currency || 'TWD';
    acc[c] = (acc[c] || 0) + Number(a.balance);
    return acc;
  }, {});
  const ratesReady = Object.keys(subtotals).every((c) => rates[c] != null);
  const totalTwd = ratesReady
    ? Object.entries(subtotals).reduce((sum, [c, v]) => sum + v * rates[c], 0)
    : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-accounts)', '--ring': 'var(--module-accounts)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('acc_pageTitle')}</h1>
      <LedgerSubNav />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
      <div>

      {!loading && accounts.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('acc_total_assets')}</p>
            <p className="mt-1 text-2xl font-semibold">
              {totalTwd == null ? '—' : `TWD ${Math.round(totalTwd).toLocaleString()}`}
            </p>
            {Object.keys(subtotals).length > 1 && (
              <>
                <p className="mt-1 text-xs text-muted-foreground md:hidden">
                  {Object.entries(subtotals).map(([c, v]) => `${c} ${v.toLocaleString()}`).join(' · ')}
                </p>
                <div className="mt-3 hidden flex-wrap gap-x-10 gap-y-2 text-sm text-muted-foreground md:flex">
                  {Object.entries(subtotals).map(([c, v]) => (
                    <span key={c} className="font-amount">
                      <span className="mr-1.5 text-xs">{c}</span>{v.toLocaleString()}
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : accounts.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">{t('acc_no_accounts')}</p>
      ) : (
        <>
        <div className="mb-6 hidden gap-4 md:grid md:grid-cols-2">
          {accounts.map((acc, idx) => (
            <div
              key={acc.id}
              className={`flex h-24 flex-col justify-between rounded-2xl px-4 py-3 text-card shadow-lg ${pickedId === acc.id ? 'ring-4 ring-ring ring-offset-2' : ''}`}
              style={{ backgroundColor: cardColor(acc, idx) }}
            >
              <p className="text-sm opacity-80">{acc.name}</p>
              <p className="text-2xl font-semibold">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="relative mb-6 h-40 md:hidden">
          {accounts.map((acc, idx) => {
            const offset = idx - activeIndex;
            if (Math.abs(offset) > 2) return null;
            return (
              <button
                key={acc.id}
                onClick={() => setActiveIndex(idx)}
                onDoubleClick={() => setActiveIndex((prev) => (prev + 1) % accounts.length)}
                className="absolute inset-x-0 h-36 rounded-2xl p-4 text-left text-card shadow-lg transition-all"
                style={{ backgroundColor: cardColor(acc, idx), top: `${Math.abs(offset) * 10}px`, transform: `scale(${1 - Math.abs(offset) * 0.05})`, zIndex: 10 - Math.abs(offset), opacity: Math.abs(offset) > 1 ? 0.5 : 1 }}
              >
                <p className="text-sm opacity-80">{acc.name}</p>
                <p className="mt-4 text-2xl font-semibold">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</p>
              </button>
            );
          })}
        </div>
        </>
      )}
      </div>

      <div className="md:sticky md:top-6">
      <div className="mb-3 flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
        <button onClick={() => switchMode('add')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${mode === 'add' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{t('mode_add')}</button>
        <button onClick={() => switchMode('edit')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${mode === 'edit' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{t('mode_edit')}</button>
        <button onClick={() => switchMode('delete')} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${mode === 'delete' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{t('mode_delete')}</button>
      </div>

      <Card>
        <CardContent className="p-4">
          {mode === 'add' && (
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="flex gap-2">
                <Input type="text" placeholder={t('acc_new_name_placeholder')} value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Select value={newCurrency} onValueChange={setNewCurrency}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit">{t('acc_add')}</Button>
              </div>
              <ColorPicker value={newColor} onChange={setNewColor} t={t} />
            </form>
          )}

          {mode === 'edit' && pickingMode && (
            <div className="space-y-1">
              <p className="mb-2 text-sm text-muted-foreground">{t('acc_pick_rename')}</p>
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => pickForEdit(acc)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cardColor(acc, accounts.indexOf(acc)) }} />
                    {acc.name}
                  </span>
                  <span className="text-muted-foreground">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'edit' && pickedId && (
            <div className="space-y-2">
              {actionError && <p className="text-sm text-red-500">{actionError}</p>}
              <Input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <ColorPicker value={editColor} onChange={setEditColor} t={t} />
              <div className="flex gap-2">
                <Button type="button" className="flex-1" onClick={saveEdit}>{t('save')}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPickedId(null)}>{t('reselect')}</Button>
              </div>
            </div>
          )}

          {mode === 'delete' && pickingMode && (
            <div className="space-y-1">
              <p className="mb-2 text-sm text-muted-foreground">{t('acc_pick_delete')}</p>
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setPickedId(acc.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cardColor(acc, accounts.indexOf(acc)) }} />
                    {acc.name}
                  </span>
                  <span className="text-muted-foreground">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'delete' && pickedId && (
            <div className="space-y-2">
              {actionError && <p className="text-sm text-red-500">{actionError}</p>}
              <p className="text-sm font-medium">{t('acc_confirm_delete_prefix')}{pickedAccount?.name}{t('acc_confirm_delete_suffix')}</p>
              <p className="text-xs text-muted-foreground">{t('acc_delete_note')}</p>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" onClick={confirmDelete}>{t('tx_confirm_delete')}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPickedId(null)}>{t('reselect')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { askUpgrade } from '../components/PlanNotice';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import LedgerSubNav from '../components/LedgerSubNav';
import { useIsDesktop } from '../lib/useIsDesktop';

export const BALANCE_ADJUST = '餘額調整';

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
  const touchX = useRef(null);
  useEffect(() => {
    if (activeIndex >= accounts.length) setActiveIndex(0);
  }, [accounts.length]);
  const [loading, setLoading] = useState(true);

  // 新增/編輯/刪除:點了才出現內容,再點一次收起
  const [mode, setMode] = useState(null);
  const isDesktop = useIsDesktop();
  const { can } = usePlan();
  const canLedger = can('ledger');

  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState('TWD');
  const [newColor, setNewColor] = useState(null);
  const [editColor, setEditColor] = useState(null);

  const [pickedId, setPickedId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [actionError, setActionError] = useState('');
  // 編輯裡的刪除確認
  const [editDeleteOpen, setEditDeleteOpen] = useState(false);
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
    const onChanged = () => load();
    window.addEventListener('yy:data-changed', onChanged);
    return () => window.removeEventListener('yy:data-changed', onChanged);
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

  function switchMode(newMode, { keep = false } = {}) {
    if (!canLedger) { askUpgrade('ledger'); return; }
    setMode(!keep && mode === newMode ? null : newMode);
    setPickedId(null);
    setEditDeleteOpen(false);
    setEditName('');
    setEditColor(null);
    setActionError('');
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName) return;
    await api.createAccount({ name: newName, balance: Number(newBalance) || 0, currency: newCurrency, color: newColor });
    setNewName('');
    setNewBalance('');
    setNewColor(null);
    load();
  }

  function pickForEdit(acc) {
    setPickedId(acc.id);
    setEditName(acc.name);
    setEditColor(acc.color || null);
    setEditBalance(String(Number(acc.balance)));
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    setActionError('');
    try {
      await api.updateAccount(pickedId, { name: editName.trim(), color: editColor });
      // 餘額有改 → 記一筆「餘額調整」,帳戶餘額由記帳紀錄自動更新(統計分析不會計入)
      const acc = accounts.find((a) => a.id === pickedId);
      const delta = Math.round((Number(editBalance) - Number(acc?.balance || 0)) * 100) / 100;
      if (editBalance !== '' && !Number.isNaN(delta) && delta !== 0) {
        await api.createTransaction({
          type: delta > 0 ? 'income' : 'expense',
          amount: Math.abs(delta),
          category: BALANCE_ADJUST,
          note: BALANCE_ADJUST,
          account_id: pickedId,
          occurred_at: new Date().toISOString(),
        });
      }
      switchMode('edit', { keep: true });
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
      setEditDeleteOpen(false);
      switchMode(mode, { keep: true });
      load();
    } catch (err) {
      console.error(err);
      setActionError(t('acc_delete_failed'));
    }
  }

  const pickingMode = (mode === 'edit' || mode === 'delete') && !pickedId;
  // 手機版帳戶卡片:左右切換(循環)
  const step = (dir) => setActiveIndex((i) => (accounts.length ? (i + dir + accounts.length) % accounts.length : 0));
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

  // 新增/編輯/刪除功能列:手機版緊接在上方功能列下面,桌機版在右側
  // 方案沒有記帳功能時只顯示唯讀提示
  const actionBar = (
    <div className="mb-3 flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
      {/* 手機版:刪除改在編輯裡操作 */}
      {(isDesktop ? ['add', 'edit', 'delete'] : ['add', 'edit']).map((m) => (
        <button key={m} type="button" onClick={() => switchMode(m)} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${mode === m ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{t(`mode_${m}`)}</button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-accounts)', '--ring': 'var(--module-accounts)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('acc_pageTitle')}</h1>
      <LedgerSubNav />
      {!isDesktop && actionBar}

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
      {/* 手機版:選了功能時只顯示功能內容,不同時顯示總資產與各帳戶金額 */}
      <div className={mode && canLedger && !isDesktop ? 'hidden' : ''}>

      {!loading && accounts.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('acc_total_assets')}</p>
            <p className="mt-1 text-2xl font-semibold">
              {totalTwd == null ? '—' : `TWD ${Math.round(totalTwd).toLocaleString()}`}
            </p>
            {Object.keys(subtotals).length > 1 && (
              <>
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

      {/* 手機版:各幣別金額獨立一個區塊 */}
      {!loading && Object.keys(subtotals).length > 1 && (
        <Card className="mb-4 md:hidden">
          <CardContent className="divide-y divide-border px-4 py-1">
            {Object.entries(subtotals).map(([c, v]) => (
              <div key={c} className="flex items-baseline justify-between py-2 font-amount">
                <span className="text-xs text-muted-foreground">{c}</span>
                <span className="text-right">
                  <span className="text-base font-semibold">{v.toLocaleString()}</span>
                  {c !== 'TWD' && rates[c] != null && (
                    <span className="ml-2 text-xs text-muted-foreground">≈ TWD {Math.round(v * rates[c]).toLocaleString()}</span>
                  )}
                </span>
              </div>
            ))}
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
        <div className="mb-6 md:hidden">
          <div
            className="relative h-28"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current == null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
            }}
          >
            {accounts.map((acc, idx) => {
              const offset = (idx - activeIndex + accounts.length) % accounts.length;
              if (offset > 2) return null;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => step(1)}
                  className="absolute inset-x-0 flex h-24 flex-col justify-between rounded-2xl px-4 py-3 text-left text-card shadow-lg transition-all"
                  style={{ backgroundColor: cardColor(acc, idx), top: `${offset * 8}px`, transform: `scale(${1 - offset * 0.04})`, zIndex: 10 - offset, opacity: offset > 1 ? 0.5 : 1 }}
                >
                  <p className="truncate text-xl font-semibold">{acc.name}</p>
                  <p className="font-amount text-xl font-semibold">{acc.currency || 'TWD'} {Number(acc.balance).toLocaleString()}</p>
                </button>
              );
            })}
          </div>
          {accounts.length > 1 && (
            <div className="mt-2 flex items-center justify-between">
              <button type="button" aria-label="prev" onClick={() => step(-1)} className="rounded-full border border-border bg-card p-1.5 shadow-sm">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {accounts.map((acc, idx) => (
                  <button
                    key={acc.id}
                    type="button"
                    aria-label={acc.name}
                    onClick={() => setActiveIndex(idx)}
                    className={`h-2 rounded-full transition-all ${idx === activeIndex ? 'w-5 bg-foreground' : 'w-2 bg-border'}`}
                  />
                ))}
                <span className="ml-1.5 font-amount text-xs text-muted-foreground">{activeIndex + 1} / {accounts.length}</span>
              </div>
              <button type="button" aria-label="next" onClick={() => step(1)} className="rounded-full border border-border bg-card p-1.5 shadow-sm">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        </>
      )}
      </div>

      <div className="md:sticky md:top-6">
      {isDesktop && actionBar}

      <Card className={mode && canLedger ? '' : 'hidden'}>
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
              <Input type="number" step="0.01" inputMode="decimal" placeholder={t('acc_opening_balance')} value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
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
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('acc_current_balance')}（{accounts.find((a) => a.id === pickedId)?.currency || 'TWD'}）</label>
                <Input type="number" step="0.01" inputMode="decimal" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} />
              </div>
              <ColorPicker value={editColor} onChange={setEditColor} t={t} />
              {editDeleteOpen ? (
                <div className="space-y-2 rounded-md border border-border p-2">
                  <p className="text-sm font-medium">{t('acc_confirm_delete_prefix')}{pickedAccount?.name}{t('acc_confirm_delete_suffix')}</p>
                  <p className="text-xs text-muted-foreground">{t('acc_delete_note')}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="destructive" className="flex-1" onClick={confirmDelete}>{t('tx_confirm_delete')}</Button>
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setEditDeleteOpen(false)}>{t('cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" className="flex-1" onClick={saveEdit}>{t('save')}</Button>
                  <Button type="button" variant="outline" onClick={() => setEditDeleteOpen(true)}>{t('mode_delete')}</Button>
                  <Button type="button" variant="outline" onClick={() => setPickedId(null)}>{t('reselect')}</Button>
                </div>
              )}
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

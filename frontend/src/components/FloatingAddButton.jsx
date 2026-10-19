import { useEffect, useRef, useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { Plus, X, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { ymd } from '../lib/recurrence';
import { REMIND_TIMED, REMIND_ALL_DAY, normalizeRemind, remindMinutes, endAtIso } from '../lib/eventRemind';

// 快速新增:任何頁面右下角的 +,可記一筆帳、新增行程或一筆待辦記事(存到墨箋絮語)
// 存好後發出 'yy:data-changed',讓目前頁面重新載入資料
const emptyTx = () => ({ type: 'expense', amount: '', account_id: '', category: '', note: '', date: ymd(new Date()) });
const emptyEv = () => ({ title: '', date: ymd(new Date()), time: '', end_date: '', end_time: '', remind: 'none', note: '' });

export default function FloatingAddButton() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('tx');
  // 依方案只顯示能用的分頁(待辦記事一律可用)
  const { can } = usePlan();
  const tabs = [can('ledger') && 'tx', can('calendar') && 'ev', 'note'].filter(Boolean);
  const [tx, setTx] = useState(emptyTx);
  const [ev, setEv] = useState(emptyEv);
  const [noteText, setNoteText] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const amountRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.listAccounts(), api.listCategories()])
      .then(([{ accounts }, { categories }]) => { setAccounts(accounts); setCategories(categories); })
      .catch((err) => console.error(err));
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [open]);

  function close() {
    setOpen(false);
    setTx(emptyTx());
    setEv(emptyEv());
    setNoteText('');
  }

  function done(msg) {
    window.dispatchEvent(new Event('yy:data-changed'));
    close();
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  async function saveTx(e) {
    e.preventDefault();
    if (!(Number(tx.amount) > 0)) return;
    setSaving(true);
    try {
      await api.createTransaction({
        type: tx.type,
        amount: Number(tx.amount),
        account_id: tx.account_id || null,
        category: tx.category || null,
        note: tx.note || null,
        occurred_at: new Date(`${tx.date}T12:00:00`).toISOString(),
      });
      done(t('qa_tx_saved'));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveEv(e) {
    e.preventDefault();
    if (!ev.title.trim()) return;
    setSaving(true);
    try {
      const start = new Date(`${ev.date}T${ev.time || '00:00'}:00`).toISOString();
      await api.createEvent({
        title: ev.title.trim(),
        start_at: start,
        end_at: endAtIso(ev),
        note: ev.note.trim() || null,
        remind_before_minutes: remindMinutes(ev.remind, !!ev.time),
        color: '#9CA3AF',
      });
      done(t('qa_ev_saved'));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await api.createNote(noteText);
      done(t('qa_note_saved'));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const txCategories = categories.filter((c) => c.type !== 'event' && (c.type === tx.type || c.type === 'general'));
  const currency = accounts.find((a) => a.id === tx.account_id)?.currency || 'TWD';
  const seg = (on) => `flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors ${on ? 'bg-muted font-medium' : 'text-muted-foreground'}`;

  return (
    <>
      <button
        type="button"
        aria-label={t('qa_open')}
        onClick={() => { if (!tabs.includes(tab)) setTab(tabs[0]); setOpen(true); }}
        className="fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95 md:right-8 md:bottom-8 md:h-14 md:w-14"
      >
        <Plus className="h-6 w-6" />
      </button>

      {toast && (
        <div className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          <Check className="h-4 w-4" />{toast}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={close}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl md:rounded-2xl md:pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex flex-1 rounded-lg border border-border bg-card p-1 shadow-sm">
                {tabs.includes('tx') && <button type="button" onClick={() => setTab('tx')} className={seg(tab === 'tx')}>{t('qa_tab_tx')}</button>}
                {tabs.includes('ev') && <button type="button" onClick={() => setTab('ev')} className={seg(tab === 'ev')}>{t('qa_tab_ev')}</button>}
                <button type="button" onClick={() => setTab('note')} className={seg(tab === 'note')}>{t('qa_tab_note')}</button>
              </div>
              <button type="button" aria-label="close" onClick={close} className="rounded-md p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            {tab === 'tx' ? (
              <form onSubmit={saveTx} className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex rounded-lg border border-border p-1">
                    {['expense', 'income'].map((ty) => (
                      <button key={ty} type="button" onClick={() => setTx({ ...tx, type: ty, category: '' })} className={seg(tx.type === ty)}>
                        {t(`type_${ty}`)}
                      </button>
                    ))}
                  </div>
                  <Input
                    ref={amountRef}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder={`${t('tx_amount')} (${currency})`}
                    value={tx.amount}
                    onChange={(e) => setTx({ ...tx, amount: e.target.value })}
                    className="min-w-0 flex-1 text-lg font-semibold"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={tx.account_id || 'none'} onValueChange={(v) => setTx({ ...tx, account_id: v === 'none' ? '' : v })}>
                    <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder={t('tx_account_placeholder')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('tx_no_account')}</SelectItem>
                      {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}({a.currency || 'TWD'})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={tx.category || 'none'} onValueChange={(v) => setTx({ ...tx, category: v === 'none' ? '' : v })}>
                    <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder={t('tx_category_placeholder')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('tx_no_category')}</SelectItem>
                      {txCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Input placeholder={t('tx_note_placeholder')} value={tx.note} onChange={(e) => setTx({ ...tx, note: e.target.value })} className="min-w-0 flex-[2]" />
                  <Input type="date" value={tx.date} onChange={(e) => setTx({ ...tx, date: e.target.value })} className="min-w-0 flex-1" required />
                </div>
                <Button type="submit" className="w-full" disabled={saving || !(Number(tx.amount) > 0)}>{t('tx_add_record')}</Button>
              </form>
            ) : tab === 'ev' ? (
              <form onSubmit={saveEv} className="space-y-2">
                <Input autoFocus placeholder={t('cal_title_placeholder')} value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} required />
                <div className="flex gap-2">
                  <Input type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} className="min-w-0 flex-1" required />
                  <Input type="time" value={ev.time} onChange={(e) => setEv({ ...ev, time: e.target.value })} className="w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs text-muted-foreground">{t('cal_end')}</span>
                  <Input type="date" value={ev.end_date} min={ev.date || undefined} onChange={(e) => setEv({ ...ev, end_date: e.target.value })} className="min-w-0 flex-1" />
                  <Input type="time" value={ev.end_time} onChange={(e) => setEv({ ...ev, end_time: e.target.value })} className="w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-muted-foreground">🔔 {t('cal_remind')}</span>
                  <Select value={normalizeRemind(ev.remind, !!ev.time)} onValueChange={(v) => setEv({ ...ev, remind: v })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(ev.time ? REMIND_TIMED : REMIND_ALL_DAY).map((v) => (
                        <SelectItem key={v} value={v}>{t(`cal_remind_${v.replace('-', 'm')}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <textarea
                  placeholder={t('qa_ev_content')}
                  value={ev.note}
                  onChange={(e) => setEv({ ...ev, note: e.target.value })}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <Button type="submit" className="w-full" disabled={saving || !ev.title.trim()}>{t('cal_add_event')}</Button>
              </form>
            ) : (
              <form onSubmit={saveNote} className="space-y-2">
                <textarea
                  autoFocus
                  placeholder={t('notes_add_placeholder')}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <Button type="submit" className="w-full" disabled={saving || !noteText.trim()}>{t('notes_add')}</Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

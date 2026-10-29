import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { planText } from '../lib/planText';
import { compressImage } from '../lib/imageCompress';
import { ymd } from '../lib/budget';
import { Button } from './ui/button';
import { LegalOverlay } from '../pages/Legal';

// 網頁版「我的方案」:回報匯款 → 管理員核對後開通(App 內不顯示,見 PlanCard)
const MONTHLY = { adv_a: 69, adv_b: 69, adv_c: 69, full: 109 };
const ADDON = 10;
const YEARLY_DISCOUNT = 100;
const ADDON_PLANS = ['adv_a', 'adv_b', 'adv_c'];
const priceOf = (plan, addon, months) => {
  const m = MONTHLY[plan] + (addon && ADDON_PLANS.includes(plan) ? ADDON : 0);
  return months === 12 ? m * 12 - YEARLY_DISCOUNT : m;
};

const TEXT = {
  zh: {
    open: '我已匯款，回報匯款資料', title: '回報匯款', plan: '方案', addon: '加購社群', monthly: '月繳', yearly: '年繳',
    due: (n) => `應付 ${n.toLocaleString()} 元`, date: '匯款日期', amount: '匯款金額', last5: '匯款帳號末 5 碼', last5Ph: '例如 12345',
    proof: '轉帳截圖（選填）', note: '備註（選填）', submit: '送出', cancel: '取消', sending: '送出中…',
    done: '已送出，核對完成後會通知您。', history: '匯款回報紀錄', withdraw: '取消這筆',
    status: { pending: '待核對', approved: '已開通', rejected: '需要再確認' }, months: (m) => (m === 12 ? '年繳' : '月繳'),
    photoFail: '照片無法讀取，請換一張', yuan: '元',
    agree: ['我已閱讀並同意', '退費規則', '（數位服務不適用七日猶豫期）'],
  },
  en: {
    open: "I've paid. Report my transfer", title: 'Report a transfer', plan: 'Plan', addon: 'Add community', monthly: 'Monthly', yearly: 'Yearly',
    due: (n) => `Amount due: NT$${n.toLocaleString()}`, date: 'Transfer date', amount: 'Amount', last5: 'Last 5 digits of your account', last5Ph: 'e.g. 12345',
    proof: 'Screenshot (optional)', note: 'Note (optional)', submit: 'Submit', cancel: 'Cancel', sending: 'Sending…',
    done: "Submitted. We'll let you know once it's checked.", history: 'Your reports', withdraw: 'Cancel',
    status: { pending: 'Waiting', approved: 'Activated', rejected: 'Needs a check' }, months: (m) => (m === 12 ? 'yearly' : 'monthly'),
    photoFail: "Couldn't read this photo. Try another one.", yuan: '',
    agree: ['I have read and agree to the ', 'refund policy', ' (the 7-day cooling-off period does not apply to this digital service)'],
  },
};

const STATUS_STYLE = {
  pending: { background: 'color-mix(in srgb, var(--highlight) 22%, transparent)' },
  approved: { background: 'color-mix(in srgb, var(--income) 18%, transparent)' },
  rejected: { background: 'color-mix(in srgb, var(--expense) 16%, transparent)' },
};

export default function PaymentReport() {
  const { language } = useLanguage();
  const T = TEXT[language] || TEXT.zh;
  const P = planText(language);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const load = () => api.listPaymentReports().then(({ reports }) => setReports(reports)).catch(() => {});
  useEffect(() => { load(); }, []);

  function open() {
    setMsg('');
    setError('');
    setForm({ plan: 'adv_a', addon: false, months: 12, paid_on: ymd(new Date()), amount: String(priceOf('adv_a', false, 12)), last5: '', proof: null, note: '', agree: false });
  }
  // 換方案時,金額跟著換成應付金額
  const setPlan = (patch) => setForm((f) => { const n = { ...f, ...patch }; return { ...n, amount: String(priceOf(n.plan, n.addon, n.months)) }; });

  async function pickProof(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { image, thumb } = await compressImage(file);
      const { key } = await api.uploadPaymentProof(image);
      setForm((f) => ({ ...f, proof: { key, thumb } }));
    } catch (err) {
      setError(err.status ? err.message : T.photoFail);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createPaymentReport({
        plan: form.plan, addon_community: form.addon, months: form.months, paid_on: form.paid_on,
        amount: Number(form.amount), account_last5: form.last5, proof_key: form.proof?.key || null, note: form.note, agree_refund_terms: form.agree,
      });
      setForm(null);
      setMsg(T.done);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id) {
    try { await api.deletePaymentReport(id); load(); } catch (err) { setError(err.message); }
  }

  const input = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
  const pill = (on) => `flex-1 rounded-md px-2 py-1.5 text-sm transition-colors ${on ? 'bg-muted font-medium' : 'text-muted-foreground'}`;

  return (
    <div className="space-y-2">
      {!form ? (
        <Button type="button" variant="outline" className="w-full" onClick={open}>{T.open}</Button>
      ) : (
        <form onSubmit={submit} className="space-y-2.5 rounded-md border border-border p-3">
          <p className="text-sm font-medium">{T.title}</p>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{T.plan}</p>
            <select value={form.plan} onChange={(e) => setPlan({ plan: e.target.value })} className={input}>
              {['adv_a', 'adv_b', 'adv_c', 'full'].map((p) => <option key={p} value={p}>{P.plan[p]}</option>)}
            </select>
          </div>
          {ADDON_PLANS.includes(form.plan) && (
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.addon} onChange={(e) => setPlan({ addon: e.target.checked })} />{T.addon}
            </label>
          )}
          <div className="flex rounded-lg border border-border bg-card p-1">
            <button type="button" className={pill(form.months === 1)} onClick={() => setPlan({ months: 1 })}>{T.monthly}</button>
            <button type="button" className={pill(form.months === 12)} onClick={() => setPlan({ months: 12 })}>{T.yearly}</button>
          </div>
          <p className="text-sm font-medium">{T.due(priceOf(form.plan, form.addon, form.months))}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">{T.date}
              <input type="date" required max={ymd(new Date())} value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} className={`${input} mt-1`} />
            </label>
            <label className="text-xs text-muted-foreground">{T.amount}
              <input type="number" required min="1" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${input} mt-1`} />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">{T.last5}
            <input required inputMode="numeric" pattern="\d{5}" maxLength={5} placeholder={T.last5Ph} value={form.last5} onChange={(e) => setForm({ ...form, last5: e.target.value.replace(/\D/g, '').slice(0, 5) })} className={`${input} mt-1`} />
          </label>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{T.proof}</p>
            {form.proof ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted">
                <img src={form.proof.thumb} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="remove" onClick={() => setForm({ ...form, proof: null })} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted/60">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickProof} />
          </div>
          <input maxLength={200} placeholder={T.note} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={input} />
          <label className="flex items-start gap-1.5 text-xs">
            <input type="checkbox" className="mt-0.5" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} />
            <span>{T.agree[0]}<button type="button" onClick={() => setTermsOpen(true)} className="underline">{T.agree[1]}</button>{T.agree[2]}</span>
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={busy || uploading || form.last5.length !== 5 || !form.agree}>{busy ? T.sending : T.submit}</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setForm(null)}>{T.cancel}</Button>
          </div>
        </form>
      )}
      {msg && <p className="text-xs" style={{ color: 'var(--income)' }}>{msg}</p>}
      <LegalOverlay doc={termsOpen ? 'terms' : null} anchor="refund" onClose={() => setTermsOpen(false)} />

      {reports.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-muted-foreground">{T.history}</p>
          {reports.map((r) => (
            <div key={r.id} className="rounded-md border border-border px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-amount">{r.paid_on.replace(/-/g, '/')}</span>
                <span className="font-amount">{Number(r.amount).toLocaleString()} {T.yuan}</span>
                <span className="truncate text-muted-foreground">{P.plan[r.plan]?.split('・')[0]}・{T.months(r.months)}</span>
                <span className="ml-auto shrink-0 rounded-full px-2 py-0.5" style={STATUS_STYLE[r.status]}>{T.status[r.status]}</span>
              </div>
              {r.status === 'rejected' && r.reject_reason && <p className="mt-1 text-[var(--expense)]">{r.reject_reason}</p>}
              {r.status === 'pending' && <button type="button" onClick={() => withdraw(r.id)} className="mt-1 text-muted-foreground underline">{T.withdraw}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

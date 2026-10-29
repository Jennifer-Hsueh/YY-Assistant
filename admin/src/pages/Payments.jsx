import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { api } from '../api';
import { fmtDateTime, PLAN_LABEL, PAID_PLANS, ADDON_PLANS } from '../labels';
import { Badge, Button, Card, DateInput, Field, Notice, PageTitle, Segmented, inputCls } from '../ui';
import { RevenueNotice } from './Overview';

// 收款管理:入帳核對(使用者回報的匯款 → 對照網銀明細 → 核對無誤就入帳開通/對不上就退回)與收款紀錄(依月份、可匯出 Excel)
const STATUS = { pending: ['待核對', 'amber'], approved: ['已入帳', 'green'], rejected: ['已退回', 'red'] };
const day = (d) => String(d || '').replace(/-/g, '/');
const money = (n) => Number(n || 0).toLocaleString();
const planName = (p, addon) => `${PLAN_LABEL[p] || p}${addon ? '＋社群' : ''}`;
const thisMonth = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);

function ReportCard({ r, onDone }) {
  const [form, setForm] = useState({ plan: r.plan, addon_community: r.addon_community, months: r.months, amount: String(r.amount), paid_at: r.paid_on });
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState(null); // approve | reject
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [label, tone] = STATUS[r.status];
  const mismatch = Number(r.amount) !== Number(r.expected_amount);

  async function run(fn) {
    setBusy(true);
    setMsg(null);
    try { await fn(); onDone(); } catch (err) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  }
  const approve = () => run(() => api.approvePaymentReport(r.id, { ...form, amount: Number(form.amount) }));
  const reject = () => run(() => api.rejectPaymentReport(r.id, reason));

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{label}</Badge>
        <p className="font-medium">{r.user ? `${r.user.username || '(未設定稱呼)'} · ${r.user.email}` : r.user_email || '(已刪除的帳號)'}</p>
        <span className="num ml-auto text-xs text-muted-foreground">回報於 {fmtDateTime(r.created_at)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm md:grid-cols-4">
        <p><span className="text-muted-foreground">匯款日期　</span><span className="num">{day(r.paid_on)}</span></p>
        <p><span className="text-muted-foreground">帳號末 5 碼　</span><span className="num font-semibold">{r.account_last5}</span></p>
        <p>
          <span className="text-muted-foreground">金額　</span><span className="num font-semibold">{money(r.amount)}</span>
          {mismatch && <span className="ml-1 text-xs text-danger">（應付 {money(r.expected_amount)}）</span>}
        </p>
        <p><span className="text-muted-foreground">方案　</span>{planName(r.plan, r.addon_community)}・{r.months === 12 ? '年繳' : `${r.months} 個月`}</p>
      </div>
      {r.user && <p className="mt-1.5 text-xs text-muted-foreground">目前方案：{PLAN_LABEL[r.user.plan] || r.user.plan}{r.user.plan_expires_at ? `，到期 ${day(r.user.plan_expires_at)}` : ''}</p>}
      {r.note && <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">{r.note}</p>}
      {r.proof_url && (
        <a href={r.proof_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink underline">
          <ImageIcon className="h-4 w-4" />查看轉帳截圖
        </a>
      )}
      {r.status === 'rejected' && <p className="mt-2 text-sm text-danger">退回原因：{r.reject_reason}</p>}
      {r.reviewed_at && <p className="mt-1 text-xs text-muted-foreground">處理於 {fmtDateTime(r.reviewed_at)}</p>}

      {r.status === 'pending' && (
        <div className="mt-4 border-t border-border pt-4">
          {!mode && (
            <div className="flex gap-2">
              <Button onClick={() => setMode('approve')}>核對無誤，入帳</Button>
              <Button variant="outline" onClick={() => setMode('reject')}>對不上，退回</Button>
            </div>
          )}
          {mode === 'approve' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">確認網銀明細的日期、金額、帳號末 5 碼都對得上。需要時可以調整下面的內容再入帳。</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Field label="方案">
                  <select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                    {PAID_PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                  </select>
                </Field>
                <Field label="月數"><input className={`${inputCls} num`} type="number" min="1" max="36" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} /></Field>
                <Field label="金額"><input className={`${inputCls} num`} type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
                <Field label="入帳日（繳費日）"><DateInput value={form.paid_at} onChange={(v) => setForm({ ...form, paid_at: v })} /></Field>
                <Field label="社群">
                  <label className="flex h-9 items-center gap-1.5 text-sm">
                    <input type="checkbox" disabled={!ADDON_PLANS.includes(form.plan)} checked={form.addon_community && ADDON_PLANS.includes(form.plan)} onChange={(e) => setForm({ ...form, addon_community: e.target.checked })} />加購社群
                  </label>
                </Field>
              </div>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={approve}>確定入帳並開通</Button>
                <Button variant="ghost" onClick={() => setMode(null)}>取消</Button>
              </div>
              <p className="text-xs text-muted-foreground">開通後會發個人公告與推播給對方（只寫方案與期限，不提金額）。</p>
            </div>
          )}
          {mode === 'reject' && (
            <div className="space-y-3">
              <Field label="退回原因（對方會在公告和推播看到，請不要寫帳號或金額）">
                <input className={inputCls} maxLength={200} value={reason} placeholder="例如：查無這筆匯款，請確認匯款日期" onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button variant="danger" disabled={busy || !reason.trim()} onClick={reject}>確定退回</Button>
                <Button variant="ghost" onClick={() => setMode(null)}>取消</Button>
              </div>
            </div>
          )}
          <Notice msg={msg} />
        </div>
      )}
    </Card>
  );
}

function Reports({ onPending }) {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.paymentReports(status).then((d) => { setData(d); onPending(d.pending); }).catch((err) => setError(err.message));
  useEffect(() => { setData(null); load(); }, [status]);
  return (
    <div className="space-y-4">
      <Segmented value={status} onChange={setStatus} options={[['pending', '待核對'], ['approved', '已入帳'], ['rejected', '已退回'], ['all', '全部']]} />
      {error && <p className="text-sm text-danger">{error}</p>}
      {!data ? <p className="text-sm text-muted-foreground">載入中…</p> : data.reports.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{status === 'pending' ? '目前沒有待核對的匯款 🎉' : '沒有資料'}</p>
      ) : data.reports.map((r) => <ReportCard key={r.id} r={r} onDone={load} />)}
    </div>
  );
}

function Ledger() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null);
    api.allPayments(month).then(setData).catch((err) => setError(err.message));
  }, [month]);

  async function exportXlsx() {
    const { default: writeXlsxFile } = await import('write-excel-file');
    const head = ['繳費日', '使用者', 'Email', '方案', '月數', '金額', '帳號末 5 碼', '期間起', '期間迄', '核對人', '核對時間', '備註'].map((value) => ({ value, fontWeight: 'bold' }));
    const rows = data.payments.map((p) => [
      day(p.paid_at), p.user_name || '', p.email || '', planName(p.plan, p.addon_community), Number(p.months), Number(p.amount), p.account_last5 || '',
      day(p.period_start), day(p.period_end), p.verified_by_name || '', p.verified_at ? fmtDateTime(p.verified_at) : '', p.note || '',
    ].map((value) => ({ value, type: typeof value === 'number' ? Number : String })));
    const total = [{ value: '合計', fontWeight: 'bold' }, null, null, null, null, { value: data.total, type: Number, fontWeight: 'bold' }, null, null, null, null, null, null];
    const widths = [12, 14, 26, 16, 6, 10, 12, 12, 12, 12, 18, 30].map((width) => ({ width }));
    await writeXlsxFile([head, ...rows, total], { columns: widths, fileName: `YY手帳收款紀錄_${month || '全部'}.xlsx`, sheet: '收款紀錄' });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="月份"><input type="month" className={`${inputCls} num w-44`} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Button variant="outline" onClick={() => setMonth('')}>最近 500 筆</Button>
        <Button className="ml-auto" disabled={!data?.payments.length} onClick={exportXlsx}><Download className="h-4 w-4" />匯出 Excel</Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {data?.revenue && data.revenue.level !== 'ok' && <RevenueNotice revenue={data.revenue} />}
      {!data ? <p className="text-sm text-muted-foreground">載入中…</p> : (
        <Card className="overflow-x-auto">
          <div className="flex items-baseline gap-4 border-b border-border px-5 py-3">
            <p className="text-sm text-muted-foreground">{month ? `${month.replace('-', ' 年 ')} 月` : '最近 500 筆'}</p>
            <p className="text-sm">共 <span className="num font-semibold">{data.count}</span> 筆</p>
            <p className="text-sm">合計 <span className="num text-lg font-semibold text-ink">{money(data.total)}</span> 元</p>
          </div>
          {data.payments.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">這個月還沒有收款</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{['繳費日', '使用者', '方案', '月數', '金額', '末 5 碼', '期間', '核對'].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="num whitespace-nowrap px-4 py-2">{day(p.paid_at)}</td>
                    <td className="px-4 py-2"><p>{p.user_name || '—'}</p><p className="text-xs text-muted-foreground">{p.email || '(已刪除的帳號)'}</p></td>
                    <td className="whitespace-nowrap px-4 py-2">{planName(p.plan, p.addon_community)}</td>
                    <td className="num px-4 py-2">{p.months}</td>
                    <td className="num px-4 py-2 text-right font-medium">{money(p.amount)}</td>
                    <td className="num px-4 py-2">{p.account_last5 || '—'}</td>
                    <td className="num whitespace-nowrap px-4 py-2 text-xs">{day(p.period_start)}–{day(p.period_end)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{p.verified_by_name || '—'}{p.report_id ? '・回報' : '・手動'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

export default function Payments({ initial = {} }) {
  const [tab, setTab] = useState(initial.tab === 'ledger' ? 'ledger' : 'reports');
  const [pending, setPending] = useState(null);
  return (
    <div>
      <PageTitle>收款管理</PageTitle>
      <div className="mb-5">
        <Segmented value={tab} onChange={setTab} options={[['reports', `入帳核對${pending ? `（${pending}）` : ''}`], ['ledger', '收款紀錄']]} />
      </div>
      {tab === 'reports' ? <Reports onPending={setPending} /> : <Ledger />}
    </div>
  );
}

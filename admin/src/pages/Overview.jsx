import { useEffect, useState } from 'react';
import { RefreshCw, DatabaseBackup } from 'lucide-react';
import { api } from '../api';
import { ROLE_LABEL, PLAN_LABEL, PLAN_DESC, PAID_PLANS, STATUS_LABEL, BOARD_LABEL, fmtDateTime } from '../labels';
import { Button, Card, DateInput, Notice, PageTitle, inputCls } from '../ui';

function Stat({ label, value, hint, onClick, tone }) {
  const color = tone === 'red' ? 'text-danger' : tone === 'amber' ? 'text-warn' : 'text-ink';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`rounded-xl border border-border bg-card p-4 text-left shadow-sm ${onClick ? 'transition-colors hover:border-ink/40' : ''}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Tag>
  );
}

// 測試版:名額、開放註冊、結束日(設定後自動發公告、App 顯示提醒)、結束測試;測試資料保留到正式版(要清空單一使用者到「使用者管理」)
// Supabase 用量:資料庫與檔案,和免費方案上限比較(超過 70% 黃色、90% 紅色)
const BUCKET_NAMES = { 'yy-community': '社群與日常時光照片', 'yy-backups': '備份檔', 'yy-payment-proofs': '匯款截圖' };
const mb = (b) => `${(b / 1048576).toFixed(b < 10485760 ? 1 : 0)} MB`;
function UsageCard({ usage }) {
  if (!usage) return null;
  if (usage.missing) {
    return <Card className="p-5"><p className="text-sm font-medium">Supabase 用量</p><p className="mt-1 text-xs text-warn">讀不到用量：請在 Supabase 執行用量的 SQL（yy_usage）</p></Card>;
  }
  const row = (name, x) => {
    const bar = x.level === 'danger' ? 'bg-danger' : x.level === 'warn' ? 'bg-warn' : 'bg-ok';
    const tone = x.level === 'danger' ? 'text-danger' : x.level === 'warn' ? 'text-warn' : 'text-muted-foreground';
    return (
      <div>
        <div className="flex justify-between text-xs"><span>{name}</span><span className={tone}>{mb(x.bytes)} / {mb(x.limit)}（{x.pct}%）</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.min(100, x.pct)}%` }} /></div>
      </div>
    );
  };
  const files = Object.entries(usage.buckets || {}).map(([k, v]) => `${BUCKET_NAMES[k] || k} ${mb(v.bytes)}（${v.files} 個）`).join('、');
  return (
    <Card className="space-y-2.5 p-5">
      <p className="text-sm font-medium">Supabase 用量（免費方案）</p>
      {row('資料庫', usage.db)}
      {row('檔案', usage.storage)}
      {files && <p className="text-xs text-muted-foreground">檔案：{files}</p>}
      {usage.level !== 'ok' && <p className={`text-xs ${usage.level === 'danger' ? 'text-danger' : 'text-warn'}`}>{usage.level === 'danger' ? '已超過 90%，請盡快升級 Supabase Pro' : '已超過 70%，接近免費方案上限，可以開始準備升級 Supabase Pro'}</p>}
      <p className="text-xs text-muted-foreground">每月流量（上限 5 GB）這裡查不到，請到 Supabase 後台的 Usage 查看</p>
    </Card>
  );
}

// 每月收款提醒:網路銷售勞務每月未達 5 萬元可暫免稅籍登記;超過 4 萬元先提醒
export function RevenueNotice({ revenue }) {
  if (!revenue) return null;
  const pct = Math.min(100, Math.round((revenue.total / revenue.limit) * 100));
  const tone = revenue.level === 'over' ? 'text-danger' : revenue.level === 'warn' ? 'text-warn' : 'text-muted-foreground';
  const bar = revenue.level === 'over' ? 'bg-danger' : revenue.level === 'warn' ? 'bg-warn' : 'bg-ok';
  return (
    <Card className="p-5">
      <p className="text-sm font-medium">免稅籍門檻（每月 {revenue.limit.toLocaleString()} 元）</p>
      <div className="mt-2 h-1.5 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>
      <p className={`mt-1.5 text-xs ${tone}`}>
        {revenue.level === 'over' ? `${revenue.month} 收款已超過 ${revenue.limit.toLocaleString()} 元，請洽國稅局或會計師辦理稅籍登記`
          : revenue.level === 'warn' ? `${revenue.month} 收款已超過 ${revenue.warn.toLocaleString()} 元，接近門檻，請開始準備稅籍登記`
            : `${revenue.month} 已收 ${pct}%，超過 ${revenue.warn.toLocaleString()} 元時會提醒`}
      </p>
    </Card>
  );
}

function BetaCard() {
  const [b, setB] = useState(null);
  const [limit, setLimit] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [founding, setFounding] = useState(null);
  const [granting, setGranting] = useState(false);
  const sync = (beta) => { setB(beta); setLimit(String(beta.limit)); setEndsAt(beta.ends_at || ''); };
  const load = () => api.beta().then(({ beta, founding: f }) => { sync(beta); setFounding(f); }).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);
  async function save(body, okText) {
    setBusy(true); setMsg(null);
    try { const { beta } = await api.setBeta(body); sync(beta); setMsg({ ok: true, text: okText }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  }
  async function foundingAction(fn, okText) {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setFounding(r.founding); setMsg({ ok: true, text: okText(r) }); setGranting(false); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  }
  if (!b) return null;
  const pct = Math.min(100, Math.round((b.used / b.limit) * 100));
  const endValid = endsAt === '' || /^\d{4}-\d{2}-\d{2}$/.test(endsAt);
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-56">
          <p className="text-sm font-medium">{b.active ? '測試版名額' : '已正式上線'}</p>
          <p className="num mt-1 text-2xl font-semibold text-ink">{b.used} / {b.limit} 人</p>
          <div className="mt-2 h-1.5 w-56 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {!b.active ? '不再限制名額、不顯示測試版標籤' : !b.open ? '已暫停開放註冊' : b.remaining === 0 ? '名額已滿，新使用者無法註冊' : `還有 ${b.remaining} 個名額`}（不含管理員）
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <label className="text-xs text-muted-foreground">名額上限
              <div className="mt-1 w-28"><input className={inputCls} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} /></div>
            </label>
            <Button variant="outline" disabled={busy || !limit || Number(limit) === b.limit} onClick={() => save({ limit: Number(limit) }, '已更新名額')}>儲存</Button>
            <Button variant="outline" disabled={busy || !b.active} onClick={() => save({ open: !b.open }, b.open ? '已暫停註冊' : '已開放註冊')}>{b.open ? '暫停註冊' : '開放註冊'}</Button>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-muted-foreground">測試結束日
              <div className="mt-1 w-36"><DateInput value={endsAt} onChange={setEndsAt} /></div>
            </label>
            <Button variant="outline" disabled={busy || !endValid || (endsAt || null) === (b.ends_at || null)} onClick={() => save({ ends_at: endsAt || null }, endsAt ? '已設定結束日，並發布公告' : '已清除結束日')}>儲存</Button>
            <Button variant="outline" disabled={busy} onClick={() => save({ active: !b.active }, b.active ? '已結束測試版' : '已恢復測試版')}>{b.active ? '結束測試版（正式上線）' : '恢復測試版'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">設定結束日後，會自動發布重要公告，App 每頁上方也會提醒使用者備份。</p>
        </div>
      </div>

      {founding && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <p className="text-sm">創始會員 <span className="num font-semibold text-ink">{founding.total}</span> 位<span className="text-muted-foreground">（已發放 {founding.granted}）</span></p>
          <p className="w-full order-last text-xs text-muted-foreground">測試期間每天 08:05 排程會自動標記用滿 5 天的人（不通知本人）；按下面按鈕可立即標記一次</p>
          <Button variant="outline" disabled={busy} onClick={() => foundingAction(api.markFounding, (r) => `新標記 ${r.marked} 位`)}>標記符合資格的使用者</Button>
          {granting ? (
            <>
              <span className="text-sm">發給 {founding.total - founding.granted} 位一年全功能？</span>
              <Button disabled={busy} onClick={() => foundingAction(api.grantFounding, (r) => `已發放給 ${r.granted} 位`)}>確認發放</Button>
              <Button variant="outline" onClick={() => setGranting(false)}>取消</Button>
            </>
          ) : (
            <Button variant="outline" disabled={busy || b.active || founding.total === founding.granted} onClick={() => setGranting(true)}>發放一年全功能</Button>
          )}
          <p className="w-full text-xs text-muted-foreground">資格：一般使用者在測試期間有使用 5 天以上（開啟 App 或新增資料的日子）。測試資料保留到正式版；正式上線後才能發放，一年從發放日起算。</p>
        </div>
      )}

      <Notice msg={msg} />
    </Card>
  );
}

function Breakdown({ title, rows, total, onPick }) {
  return (
    <Card className="p-5">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ul className="space-y-2.5">
        {rows.map(([key, label, n]) => (
          <li key={key}>
            <button type="button" onClick={() => onPick(key)} className="group w-full text-left">
              <div className="mb-1 flex justify-between text-sm">
                <span className="group-hover:underline">{label}</span>
                <span className="num font-medium">{n}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-ink/70" style={{ width: total ? `${(n / total) * 100}%` : 0 }} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Overview({ go }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api.overview().then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">載入中…</p>;
  const { users: u, posts: p, backup } = data;

  const backupAge = backup ? Math.floor((Date.now() - new Date(backup.created_at || backup.date).getTime()) / 86400000) : null;

  return (
    <>
      <PageTitle right={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" />重新整理</Button>}>總覽</PageTitle>

      <BetaCard />

      <p className="mb-2 text-sm font-medium text-muted-foreground">收款</p>
      <div className="mb-8 grid grid-cols-[1fr_1fr_2fr] gap-3">
        <Stat label="本月收款" value={`${Number(data.revenue?.total || 0).toLocaleString()} 元`} tone={data.revenue?.level === 'over' ? 'red' : data.revenue?.level === 'warn' ? 'amber' : undefined} onClick={() => go('payments', { tab: 'ledger' })} />
        <Stat label="待核對匯款" value={data.paymentReportsPending ?? 0} tone={data.paymentReportsPending ? 'amber' : undefined} onClick={() => go('payments')} />
        <RevenueNotice revenue={data.revenue} />
      </div>

      <p className="mb-2 text-sm font-medium text-muted-foreground">使用者</p>
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="使用者總數" value={u.total} onClick={() => go('users')} />
        <Stat label="本週活躍" value={u.active7} hint={`30 天內 ${u.active30} 人`} />
        <Stat label="本週新註冊" value={u.new7} hint={`30 天內 ${u.new30} 人`} />
        <Stat label="已停用帳號" value={u.disabled} tone={u.disabled ? 'red' : undefined} onClick={() => go('users', { status: 'disabled' })} />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Breakdown
          title="依方案狀態"
          total={u.total}
          rows={['trial', 'active', 'grace', 'basic', 'staff'].map((k) => [k, STATUS_LABEL[k], u.byStatus[k] || 0])}
          onPick={(status) => go('users', { status })}
        />
        <Breakdown
          title={`付費方案(含寬限期,加購社群 ${u.addonCommunity} 人)`}
          total={PAID_PLANS.reduce((n, k) => n + (u.byPlan[k] || 0), 0)}
          rows={PAID_PLANS.map((k) => [k, `${PLAN_LABEL[k]}・${PLAN_DESC[k]}`, u.byPlan[k] || 0])}
          onPick={(plan) => go('users', { plan, status: 'active' })}
        />
        <Breakdown
          title="依身份"
          total={u.total}
          rows={Object.keys(ROLE_LABEL).map((k) => [k, ROLE_LABEL[k], u.byRole[k] || 0])}
          onPick={(role) => go('users', { role })}
        />
      </div>

      <div className="mb-8 grid grid-cols-4 gap-3">
        <Stat label="試用 30 天內結束" value={u.trialEnding} tone={u.trialEnding ? 'amber' : undefined} onClick={() => go('users', { status: 'trial_ending' })} />
        <Stat label="付費 30 天內到期" value={u.expiring} tone={u.expiring ? 'amber' : undefined} onClick={() => go('users', { status: 'expiring' })} />
        <Stat label="寬限期中" value={u.grace} tone={u.grace ? 'red' : undefined} hint="到期後 7 天內,功能照常" onClick={() => go('users', { status: 'grace' })} />
        <Stat
          label="已過期(改為基本功能)"
          value={u.expired}
          hint={`基本功能:記帳 ${u.basicChoice.ledger}・行事曆 ${u.basicChoice.calendar}・未選 ${u.basicChoice.none}`}
          onClick={() => go('users', { status: 'expired' })}
        />
      </div>

      <p className="mb-2 text-sm font-medium text-muted-foreground">社群</p>
      <div className="mb-8 grid grid-cols-4 gap-3">
        <Stat label="公開文章" value={p.public} hint={Object.entries(p.byBoard).map(([b, n]) => `${BOARD_LABEL[b]} ${n}`).join(' · ')} />
        <Stat label="本週新文章" value={p.new7} hint={`全部 ${p.total} 篇(含私人)`} />
        <Stat label="待處理檢舉" value={p.reported} tone={p.reported ? 'amber' : undefined} hint="被檢舉但尚未隱藏" onClick={() => go('reports', { filter: 'reported' })} />
        <Stat label="已隱藏文章" value={p.hidden} onClick={() => go('reports', { filter: 'hidden' })} />
      </div>

      <p className="mb-2 text-sm font-medium text-muted-foreground">系統</p>
      <div className="grid grid-cols-[1fr_3fr] gap-3">
      <Stat label="待處理故障通報" value={data.bugsNew ?? '—'} tone={data.bugsNew ? 'red' : undefined} onClick={() => go('bugs')} />
      <Card className="flex items-center gap-4 p-5">
        <DatabaseBackup className={`h-8 w-8 ${backup && backupAge <= 8 ? 'text-ok' : 'text-danger'}`} />
        <div>
          <p className="text-sm font-medium">最近一次每週備份</p>
          {backup ? (
            <p className="text-sm text-muted-foreground">
              {backup.created_at ? fmtDateTime(backup.created_at) : backup.date}(共保留 {backup.count} 份)
              {backupAge > 8 && <span className="ml-2 text-danger">已超過 8 天沒有新備份,請檢查 cron-job.org</span>}
            </p>
          ) : (
            <p className="text-sm text-danger">找不到備份檔</p>
          )}
        </div>
      </Card>
      </div>
      <div className="mt-3"><UsageCard usage={data.usage} /></div>
    </>
  );
}

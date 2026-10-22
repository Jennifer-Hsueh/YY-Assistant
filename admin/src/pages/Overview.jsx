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

// 測試版:名額、開放註冊、結束日(設定後自動發公告、App 顯示提醒)、結束測試、備份並清空測試資料
function BetaCard() {
  const [b, setB] = useState(null);
  const [limit, setLimit] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const sync = (beta) => { setB(beta); setLimit(String(beta.limit)); setEndsAt(beta.ends_at || ''); };
  const load = () => api.beta().then(({ beta }) => sync(beta)).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);
  async function save(body, okText) {
    setBusy(true); setMsg(null);
    try { const { beta } = await api.setBeta(body); sync(beta); setMsg({ ok: true, text: okText }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  }
  async function clearAll() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.clearBetaData(confirmText);
      const total = Object.values(r.counts).reduce((x, y) => x + y, 0);
      setMsg({ ok: true, text: `已備份到 ${r.backup}，並清空 ${r.users} 位使用者的 ${total} 筆資料` });
      setClearing(false); setConfirmText('');
    } catch (e) { setMsg({ ok: false, text: e.message }); }
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

      <div className="mt-5 border-t border-border pt-4">
        {clearing ? (
          <div className="space-y-2 rounded-lg border border-danger/40 p-3">
            <p className="text-sm">會先把全站資料備份到「備份還原」的 beta-end 資料夾，再清空所有使用者（不含管理員）的記帳、行事曆、記事、心情與社群資料。帳號、方案、繳費紀錄、公告與故障通報會保留。</p>
            <p className="text-sm">確認請輸入「清空測試資料」</p>
            <div className="flex gap-2">
              <input className={inputCls} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              <Button variant="danger" className="shrink-0 whitespace-nowrap" disabled={busy || confirmText !== '清空測試資料'} onClick={clearAll}>備份並清空</Button>
              <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => { setClearing(false); setConfirmText(''); }}>取消</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="text-danger" onClick={() => setClearing(true)}>備份並清空測試資料</Button>
        )}
      </div>
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
    </>
  );
}

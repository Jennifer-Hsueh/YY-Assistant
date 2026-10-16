import { useEffect, useState } from 'react';
import { RefreshCw, DatabaseBackup } from 'lucide-react';
import { api } from '../api';
import { ROLE_LABEL, PLAN_LABEL, BOARD_LABEL, fmtDateTime } from '../labels';
import { Button, Card, PageTitle } from '../ui';

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

      <p className="mb-2 text-sm font-medium text-muted-foreground">使用者</p>
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="使用者總數" value={u.total} onClick={() => go('users')} />
        <Stat label="本週活躍" value={u.active7} hint={`30 天內 ${u.active30} 人`} />
        <Stat label="本週新註冊" value={u.new7} hint={`30 天內 ${u.new30} 人`} />
        <Stat label="已停用帳號" value={u.disabled} tone={u.disabled ? 'red' : undefined} onClick={() => go('users', { status: 'disabled' })} />
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Breakdown
          title="依身份"
          total={u.total}
          rows={Object.keys(ROLE_LABEL).map((k) => [k, ROLE_LABEL[k], u.byRole[k] || 0])}
          onPick={(role) => go('users', { role })}
        />
        <Breakdown
          title="依方案"
          total={u.total}
          rows={Object.keys(PLAN_LABEL).map((k) => [k, PLAN_LABEL[k], u.byPlan[k] || 0])}
          onPick={(plan) => go('users', { plan })}
        />
        <div className="grid grid-rows-2 gap-3">
          <Stat label="權限 14 天內到期" value={u.expiring} tone={u.expiring ? 'amber' : undefined} onClick={() => go('users', { status: 'expiring' })} />
          <Stat label="權限已過期" value={u.expired} tone={u.expired ? 'red' : undefined} onClick={() => go('users', { status: 'expired' })} />
        </div>
      </div>

      <p className="mb-2 text-sm font-medium text-muted-foreground">社群</p>
      <div className="mb-8 grid grid-cols-4 gap-3">
        <Stat label="公開文章" value={p.public} hint={Object.entries(p.byBoard).map(([b, n]) => `${BOARD_LABEL[b]} ${n}`).join(' · ')} />
        <Stat label="本週新文章" value={p.new7} hint={`全部 ${p.total} 篇(含私人)`} />
        <Stat label="待處理檢舉" value={p.reported} tone={p.reported ? 'amber' : undefined} hint="被檢舉但尚未隱藏" onClick={() => go('reports', { filter: 'reported' })} />
        <Stat label="已隱藏文章" value={p.hidden} onClick={() => go('reports', { filter: 'hidden' })} />
      </div>

      <p className="mb-2 text-sm font-medium text-muted-foreground">系統</p>
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
    </>
  );
}

import { useEffect, useState } from 'react';
import { Search, Copy, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { ROLE_LABEL, PLAN_LABEL, fmtDate, fmtDateTime, ago } from '../labels';
import { Badge, Button, Card, Field, Notice, PageTitle, inputCls } from '../ui';

const STATUS_LABEL = { active: '使用中', disabled: '已停用', expiring: '14 天內到期', expired: '權限已過期' };
const emptyFilters = { q: '', role: '', plan: '', status: '' };

function CopyId({ id }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={id}
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(id); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-ink"
    >
      {id.slice(0, 8)}{done ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ExpiryCell({ u }) {
  if (!u.plan_expires_at) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className="num">{u.plan_expires_at}</span>
      {u.expiry === 'expiring' && <Badge tone="amber">即將到期</Badge>}
      {u.expiry === 'expired' && <Badge tone="red">已過期</Badge>}
    </span>
  );
}

function EditPanel({ user, selfId, onClose, onSaved }) {
  const [form, setForm] = useState({
    role: user.role || 'user',
    plan: user.plan || 'free',
    last_payment_date: user.last_payment_date || '',
    plan_expires_at: user.plan_expires_at || '',
  });
  const [reason, setReason] = useState('');
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const isSelf = user.id === selfId;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(body, okText) {
    setBusy(true);
    setMsg(null);
    try {
      const { user: updated } = await api.updateUser(user.id, body);
      onSaved(updated);
      setMsg({ ok: true, text: okText });
      setConfirmDisable(false);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  // 快速延長:從目前截止日(或今天)起算
  function extend(months) {
    const base = form.plan_expires_at && form.plan_expires_at > fmtDate(new Date().toISOString()) ? new Date(form.plan_expires_at + 'T00:00:00') : new Date();
    base.setMonth(base.getMonth() + months);
    setForm((f) => ({ ...f, plan_expires_at: fmtDate(base.toISOString()) }));
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <div className="h-full w-[420px] overflow-y-auto bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-ink">{user.username || '(未設定稱呼)'}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <dl className="mb-6 grid grid-cols-[88px_1fr] gap-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
          <dt className="text-muted-foreground">使用者 ID</dt><dd className="break-all font-mono text-xs leading-5">{user.id}</dd>
          <dt className="text-muted-foreground">註冊時間</dt><dd>{fmtDateTime(user.created_at)}</dd>
          <dt className="text-muted-foreground">最後上線</dt><dd>{user.last_active_at ? `${fmtDateTime(user.last_active_at)}(${ago(user.last_active_at)})` : '從未'}</dd>
        </dl>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="身份">
              <select className={inputCls} value={form.role} onChange={set('role')} disabled={isSelf}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="方案">
              <select className={inputCls} value={form.plan} onChange={set('plan')}>
                {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="最近付款日">
              <input type="date" className={inputCls} value={form.last_payment_date} onChange={set('last_payment_date')} />
            </Field>
            <Field label="權限截止日">
              <input type="date" className={inputCls} value={form.plan_expires_at} onChange={set('plan_expires_at')} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">截止日快速設定:</span>
            {[1, 3, 6, 12].map((m) => (
              <button key={m} type="button" onClick={() => extend(m)} className="rounded-md border border-border px-2 py-0.5 hover:bg-muted">+{m} 個月</button>
            ))}
            <button type="button" onClick={() => setForm((f) => ({ ...f, plan_expires_at: '' }))} className="rounded-md border border-border px-2 py-0.5 hover:bg-muted">不限期</button>
          </div>
          {isSelf && <p className="text-xs text-muted-foreground">不能修改自己的身份,也不能停用自己。</p>}
          <Button className="w-full" disabled={busy} onClick={() => save(form, '已儲存')}>儲存變更</Button>
        </div>

        <div className="mt-8 border-t border-border pt-5">
          <p className="mb-2 text-sm font-medium">帳號狀態</p>
          {user.is_disabled ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
                <p>已停用({fmtDateTime(user.disabled_at)})</p>
                {user.disabled_reason && <p className="mt-1 text-foreground/80">原因:{user.disabled_reason}</p>}
              </div>
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => save({ is_disabled: false }, '已恢復使用')}>恢復使用</Button>
            </div>
          ) : confirmDisable ? (
            <div className="space-y-3 rounded-lg border border-danger/40 p-3">
              <p className="text-sm">停用後,這位使用者會立即被登出,也無法再登入。資料會保留,隨時可以恢復。</p>
              <Field label="停用原因(只有後台看得到)">
                <input className={inputCls} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="例如:多次發布廣告" />
              </Field>
              <div className="flex gap-2">
                <Button variant="danger" className="flex-1" disabled={busy} onClick={() => save({ is_disabled: true, disabled_reason: reason }, '已停用')}>確認停用</Button>
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDisable(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full text-danger" disabled={isSelf} onClick={() => setConfirmDisable(true)}>停用帳號</Button>
          )}
        </div>

        <div className="mt-4"><Notice msg={msg} /></div>
      </div>
    </div>
  );
}

export default function UsersPage({ initial, selfId }) {
  const [filters, setFilters] = useState({ ...emptyFilters, ...initial });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.users({ ...filters, page }).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
    }, filters.q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [filters, page]);

  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };
  const hasFilter = Object.keys(emptyFilters).some((k) => filters[k]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function onSaved(u) {
    setEditing(u);
    setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? u : x)) }));
  }

  return (
    <>
      <PageTitle>使用者管理</PageTitle>

      <Card className="mb-4 flex items-end gap-3 p-4">
        <Field label="搜尋" className="flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className={`${inputCls} pl-9`} placeholder="稱呼、Email 或使用者 ID" value={filters.q} onChange={setFilter('q')} />
          </div>
        </Field>
        <Field label="身份" className="w-36">
          <select className={inputCls} value={filters.role} onChange={setFilter('role')}>
            <option value="">全部</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="方案" className="w-36">
          <select className={inputCls} value={filters.plan} onChange={setFilter('plan')}>
            <option value="">全部</option>
            {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="狀態" className="w-36">
          <select className={inputCls} value={filters.status} onChange={setFilter('status')}>
            <option value="">全部</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {hasFilter && <Button variant="ghost" onClick={() => { setFilters(emptyFilters); setPage(1); }}>清除</Button>}
      </Card>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">使用者 ID</th>
              <th className="px-3 py-2.5 font-medium">稱呼 / Email</th>
              <th className="px-3 py-2.5 font-medium">身份</th>
              <th className="px-3 py-2.5 font-medium">方案</th>
              <th className="px-3 py-2.5 font-medium">權限截止日</th>
              <th className="px-3 py-2.5 font-medium">註冊</th>
              <th className="px-3 py-2.5 font-medium">最後上線</th>
              <th className="px-4 py-2.5 font-medium">狀態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!data ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">載入中…</td></tr>
            ) : data.users.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">沒有符合的使用者</td></tr>
            ) : data.users.map((u) => (
              <tr key={u.id} onClick={() => setEditing(u)} className="cursor-pointer hover:bg-muted/40">
                <td className="px-4 py-2.5"><CopyId id={u.id} /></td>
                <td className="max-w-64 px-3 py-2.5">
                  <p className="truncate">{u.username || <span className="text-muted-foreground">(未設定)</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-3 py-2.5">{u.role === 'admin' ? <Badge tone="ink">{ROLE_LABEL.admin}</Badge> : ROLE_LABEL[u.role || 'user']}</td>
                <td className="px-3 py-2.5">{PLAN_LABEL[u.plan || 'free']}</td>
                <td className="px-3 py-2.5"><ExpiryCell u={u} /></td>
                <td className="num px-3 py-2.5 text-muted-foreground">{fmtDate(u.created_at)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{ago(u.last_active_at)}</td>
                <td className="px-4 py-2.5">{u.is_disabled ? <Badge tone="red">已停用</Badge> : <Badge tone="green">使用中</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {data.total} 人</span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="num">{page} / {pages}</span>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      )}

      {editing && <EditPanel key={editing.id} user={editing} selfId={selfId} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </>
  );
}

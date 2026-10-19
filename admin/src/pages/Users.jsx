import { useEffect, useState } from 'react';
import { Search, Copy, Check, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { api } from '../api';
import {
  ROLE_LABEL, PLAN_LABEL, PLAN_DESC, PAID_PLANS, ADDON_PLANS, CHOICE_LABEL, STATUS_LABEL, STATUS_TONE,
  priceFor, planText, fmtDate, fmtDateTime, ago,
} from '../labels';
import { Badge, Button, Card, Field, Notice, PageTitle, inputCls } from '../ui';

const STATUS_FILTER = {
  trial: '試用中',
  trial_ending: '試用 30 天內結束',
  active: '付費中',
  expiring: '付費 30 天內到期',
  grace: '寬限期',
  expired: '已過期(基本功能)',
  basic: '基本功能(全部)',
  staff: '不受限制',
  disabled: '已停用帳號',
};
const emptyFilters = { q: '', role: '', plan: '', status: '', exp_from: '', exp_to: '' };
const today = () => fmtDate(new Date().toISOString());

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

function StatusBadge({ u }) {
  const e = u.ent || {};
  let extra = '';
  if (e.status === 'trial' && e.days_left != null) extra = `剩 ${e.days_left} 天`;
  if (e.status === 'active' && e.days_left != null && e.days_left <= 30) extra = `剩 ${e.days_left} 天`;
  if (e.status === 'grace') extra = `至 ${e.grace_ends_at}`;
  const tone = e.status === 'active' && e.days_left != null && e.days_left <= 30 ? 'amber' : e.status === 'basic' && e.expiry === 'expired' ? 'red' : STATUS_TONE[e.status];
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge tone={tone}>{e.status === 'basic' && e.expiry === 'expired' ? '已過期' : STATUS_LABEL[e.status] || '—'}</Badge>
      {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
    </span>
  );
}

function Payments({ user, onUserChange }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ paid_at: today(), plan: PAID_PLANS.includes(user.plan) ? user.plan : 'adv_a', months: 1, addon_community: !!user.addon_community, amount: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    api.payments(user.id).then(({ payments }) => setList(payments)).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [user.id]);

  const addonOk = ADDON_PLANS.includes(form.plan);
  const suggested = priceFor(form.plan, addonOk && form.addon_community, Number(form.months));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      const body = { ...form, months: Number(form.months), addon_community: addonOk && form.addon_community, amount: form.amount === '' ? undefined : Number(form.amount) };
      const { payment, user: updated } = await api.addPayment(user.id, body);
      setList((l) => [payment, ...(l || [])]);
      onUserChange(updated);
      setForm((f) => ({ ...f, amount: '', note: '' }));
      setMsg({ ok: true, text: `已登記,權限截止日延到 ${updated.plan_expires_at}` });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(pid) {
    try {
      await api.deletePayment(user.id, pid);
      setList((l) => l.filter((p) => p.id !== pid));
      setConfirmId(null);
      setMsg({ ok: true, text: '已刪除紀錄(權限截止日沒有變動,需要時請在上方手動調整)' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  return (
    <div className="mt-8 border-t border-border pt-5">
      <p className="mb-3 text-sm font-medium">繳費紀錄</p>
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="繳費日期">
            <input type="date" className={inputCls} value={form.paid_at} onChange={set('paid_at')} />
          </Field>
          <Field label="方案">
            <select className={inputCls} value={form.plan} onChange={set('plan')}>
              {PAID_PLANS.map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}・{PLAN_DESC[k]}</option>)}
            </select>
          </Field>
          <Field label="期間">
            <select className={inputCls} value={form.months} onChange={set('months')}>
              <option value={1}>1 個月</option>
              <option value={3}>3 個月</option>
              <option value={6}>6 個月</option>
              <option value={12}>1 年(年繳)</option>
            </select>
          </Field>
          <Field label={`金額(建議 ${suggested} 元)`}>
            <input type="number" min="0" className={inputCls} placeholder={String(suggested)} value={form.amount} onChange={set('amount')} />
          </Field>
        </div>
        <label className={`flex items-center gap-2 text-sm ${addonOk ? '' : 'text-muted-foreground'}`}>
          <input type="checkbox" checked={addonOk && form.addon_community} disabled={!addonOk} onChange={set('addon_community')} />
          加購社群(+10 元/月){!addonOk && '・完整版已包含'}
        </label>
        <Field label="備註">
          <input className={inputCls} value={form.note} maxLength={300} onChange={set('note')} placeholder="例如:轉帳末五碼 12345" />
        </Field>
        <Button className="w-full" disabled={busy} onClick={add}>登記繳費並延長權限</Button>
        <p className="text-xs text-muted-foreground">截止日還在寬限期內就從原截止日接續,否則從繳費日起算。</p>
      </div>
      <div className="mt-2"><Notice msg={msg} /></div>

      <ul className="mt-3 divide-y divide-border text-sm">
        {list === null ? (
          <li className="py-2 text-muted-foreground">載入中…</li>
        ) : list.length === 0 ? (
          <li className="py-2 text-muted-foreground">還沒有繳費紀錄</li>
        ) : list.map((p) => (
          <li key={p.id} className="py-2.5">
            <div className="flex items-center gap-2">
              <span className="num font-medium">{p.paid_at}</span>
              <span>{PLAN_LABEL[p.plan] || p.plan}{p.addon_community ? '+社群' : ''}・{p.months === 12 ? '年繳' : `${p.months} 個月`}</span>
              <span className="num ml-auto">{Number(p.amount).toLocaleString()} 元</span>
              {confirmId === p.id ? (
                <span className="flex gap-1">
                  <button type="button" className="text-xs text-danger underline" onClick={() => remove(p.id)}>確認刪除</button>
                  <button type="button" className="text-xs underline" onClick={() => setConfirmId(null)}>取消</button>
                </span>
              ) : (
                <button type="button" title="刪除紀錄" className="text-muted-foreground hover:text-danger" onClick={() => setConfirmId(p.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
            <p className="num text-xs text-muted-foreground">期間 {p.period_start} → {p.period_end}{p.note ? `・${p.note}` : ''}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditPanel({ user, selfId, onClose, onSaved }) {
  const [form, setForm] = useState({
    role: user.role || 'user',
    plan: user.plan || 'basic',
    addon_community: !!user.addon_community,
    basic_choice: user.basic_choice || '',
    trial_ends_at: user.trial_ends_at || '',
    last_payment_date: user.last_payment_date || '',
    plan_expires_at: user.plan_expires_at || '',
  });
  const [reason, setReason] = useState('');
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const isSelf = user.id === selfId;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 繳費後後端會更新方案與截止日:同步到表單
  function syncFrom(u) {
    setForm((f) => ({ ...f, plan: u.plan, addon_community: !!u.addon_community, last_payment_date: u.last_payment_date || '', plan_expires_at: u.plan_expires_at || '' }));
    onSaved(u);
  }

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

  const saveForm = () => save({
    ...form,
    addon_community: ADDON_PLANS.includes(form.plan) && form.addon_community,
    basic_choice: form.basic_choice || null,
  }, '已儲存');

  const ent = user.ent || {};

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <div className="h-full w-[460px] overflow-y-auto bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
          <dt className="text-muted-foreground">目前狀態</dt>
          <dd className="flex items-center gap-2"><StatusBadge u={user} /><span className="text-xs text-muted-foreground">{planText(user)}</span></dd>
          <dt className="text-muted-foreground">試用到</dt><dd>{ent.trial_ends_at || '—'}</dd>
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
                {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}・{PLAN_DESC[k]}</option>)}
              </select>
            </Field>
            <Field label="基本功能選擇">
              <select className={inputCls} value={form.basic_choice} onChange={set('basic_choice')}>
                <option value="">未選擇</option>
                {Object.entries(CHOICE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="試用結束日">
              <input type="date" className={inputCls} value={form.trial_ends_at} onChange={set('trial_ends_at')} />
            </Field>
            <Field label="最近付款日">
              <input type="date" className={inputCls} value={form.last_payment_date} onChange={set('last_payment_date')} />
            </Field>
            <Field label="權限截止日">
              <input type="date" className={inputCls} value={form.plan_expires_at} onChange={set('plan_expires_at')} />
            </Field>
          </div>
          <label className={`flex items-center gap-2 text-sm ${ADDON_PLANS.includes(form.plan) ? '' : 'text-muted-foreground'}`}>
            <input type="checkbox" checked={ADDON_PLANS.includes(form.plan) && form.addon_community} disabled={!ADDON_PLANS.includes(form.plan)} onChange={set('addon_community')} />
            加購社群
          </label>
          <p className="text-xs text-muted-foreground">試用結束日空白 = 註冊日起三個月;權限截止日空白 = 付費方案不限期。繳費請用下方「繳費紀錄」登記,會自動延長截止日。</p>
          {isSelf && <p className="text-xs text-muted-foreground">不能修改自己的身份,也不能停用自己。</p>}
          <Button className="w-full" disabled={busy} onClick={saveForm}>儲存變更</Button>
          <Notice msg={msg} />
        </div>

        <Payments key={user.id} user={user} onUserChange={syncFrom} />

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

      <Card className="mb-4 space-y-3 p-4">
        <div className="flex items-end gap-3">
          <Field label="搜尋" className="flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input className={`${inputCls} pl-9`} placeholder="稱呼、Email 或使用者 ID" value={filters.q} onChange={setFilter('q')} />
            </div>
          </Field>
          <Field label="身份" className="w-32">
            <select className={inputCls} value={filters.role} onChange={setFilter('role')}>
              <option value="">全部</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="方案" className="w-32">
            <select className={inputCls} value={filters.plan} onChange={setFilter('plan')}>
              <option value="">全部</option>
              {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="狀態" className="w-44">
            <select className={inputCls} value={filters.status} onChange={setFilter('status')}>
              <option value="">全部</option>
              {Object.entries(STATUS_FILTER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex items-end gap-3">
          <Field label="權限截止日 從" className="w-44">
            <input type="date" className={inputCls} value={filters.exp_from} onChange={setFilter('exp_from')} />
          </Field>
          <Field label="到" className="w-44">
            <input type="date" className={inputCls} value={filters.exp_to} min={filters.exp_from || undefined} onChange={setFilter('exp_to')} />
          </Field>
          <span className="pb-2 text-xs text-muted-foreground">有設定日期時,依截止日由近到遠排序</span>
          {hasFilter && <Button variant="ghost" className="ml-auto" onClick={() => { setFilters(emptyFilters); setPage(1); }}>清除條件</Button>}
        </div>
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
              <th className="px-3 py-2.5 font-medium">狀態</th>
              <th className="px-3 py-2.5 font-medium">權限截止日</th>
              <th className="px-3 py-2.5 font-medium">註冊</th>
              <th className="px-3 py-2.5 font-medium">最後上線</th>
              <th className="px-4 py-2.5 font-medium">帳號</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!data ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">載入中…</td></tr>
            ) : data.users.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">沒有符合的使用者</td></tr>
            ) : data.users.map((u) => (
              <tr key={u.id} onClick={() => setEditing(u)} className="cursor-pointer hover:bg-muted/40">
                <td className="px-4 py-2.5"><CopyId id={u.id} /></td>
                <td className="max-w-56 px-3 py-2.5">
                  <p className="truncate">{u.username || <span className="text-muted-foreground">(未設定)</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-3 py-2.5">{u.role === 'admin' ? <Badge tone="ink">{ROLE_LABEL.admin}</Badge> : ROLE_LABEL[u.role || 'user']}</td>
                <td className="px-3 py-2.5">{planText(u)}</td>
                <td className="px-3 py-2.5"><StatusBadge u={u} /></td>
                <td className="num px-3 py-2.5">{u.plan_expires_at || <span className="text-muted-foreground">—</span>}</td>
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

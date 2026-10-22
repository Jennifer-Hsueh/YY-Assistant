import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, AlertTriangle, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { fmtDateTime } from '../labels';
import { Badge, Button, Card, Field, Notice, PageTitle, inputCls } from '../ui';

const TABLE_LABEL = {
  yy_users: '使用者', yy_accounts: '帳戶', yy_categories: '分類', yy_transactions: '記帳', yy_recurring_items: '循環項目',
  yy_events: '行程', yy_budgets: '預算', yy_moods: '心情', yy_notes: '墨箋絮語', yy_announcements: '公告',
  yy_posts: '社群文章', yy_post_comments: '留言', yy_post_reactions: '回應', yy_post_reports: '檢舉',
  yy_payments: '繳費紀錄', yy_plan_notices: '到期通知紀錄', yy_bug_reports: '故障通報',
};
const kb = (n) => (n == null ? '—' : n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`);

function CountGrid({ counts }) {
  return (
    <div className="grid grid-cols-4 gap-x-6 gap-y-1.5 text-sm">
      {Object.entries(counts).map(([t, n]) => (
        <div key={t} className="flex justify-between border-b border-border/60 py-1">
          <span className="text-muted-foreground">{TABLE_LABEL[t] || t}</span>
          <span className="num">{n}</span>
        </div>
      ))}
    </div>
  );
}

function UserRestore({ path, users, onDone }) {
  const [userId, setUserId] = useState('');
  const [q, setQ] = useState('');
  const [counts, setCounts] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const user = users.find((u) => u.id === userId);
  const matches = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return [];
    return users.filter((u) => u.email.toLowerCase().includes(kw) || (u.username || '').toLowerCase().includes(kw) || u.id.startsWith(kw)).slice(0, 6);
  }, [q, users]);

  useEffect(() => {
    setCounts(null);
    if (!userId) return;
    api.backupSummary(path, userId).then((d) => setCounts(d.userCounts)).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [userId, path]);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.restoreBackup({ path, scope: 'user', user_id: userId, confirm });
      setMsg({ ok: true, text: `已還原${r.recreated ? '(帳號已重建)' : ''}。還原前的資料已另存:${r.safety}` });
      onDone();
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <p className="mb-1 font-medium">還原單一使用者</p>
      <p className="mb-4 text-sm text-muted-foreground">把這位使用者的記帳、行事曆、記事、心情與社群資料換回備份當時的內容。帳號設定、方案與繳費紀錄不會變動;帳號已刪除的話會重建。</p>
      {user ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="flex-1">{user.username || '(未設定稱呼)'} <span className="text-muted-foreground">· {user.email}</span></span>
          <button type="button" className="text-xs underline" onClick={() => { setUserId(''); setConfirm(''); setMsg(null); }}>重新選擇</button>
        </div>
      ) : (
        <div className="relative mb-3">
          <input className={inputCls} placeholder="輸入 Email、稱呼或 ID 搜尋備份裡的使用者" value={q} onChange={(e) => setQ(e.target.value)} />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              {matches.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => { setUserId(u.id); setQ(''); }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {u.username || '(未設定稱呼)'} <span className="text-muted-foreground">· {u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {user && (
        <>
          <p className="mb-2 text-xs text-muted-foreground">備份裡這位使用者的資料筆數</p>
          {counts ? <CountGrid counts={counts} /> : <p className="text-sm text-muted-foreground">讀取中…</p>}
          <div className="mt-4 flex items-end gap-3">
            <Field label={`確認:請輸入這位使用者的 Email(${user.email})`} className="flex-1">
              <input className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button disabled={busy || confirm.trim().toLowerCase() !== user.email.toLowerCase()} onClick={run}>
              <RotateCcw className="h-4 w-4" />{busy ? '還原中…' : '還原這位使用者'}
            </Button>
          </div>
        </>
      )}
      <div className="mt-3"><Notice msg={msg} /></div>
    </Card>
  );
}

function FullRestore({ path, onDone }) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.restoreBackup({ path, scope: 'all', confirm });
      setMsg({ ok: true, text: `全站已還原。還原前的資料已另存:${r.safety}(需要時可以用它再還原回來)` });
      onDone();
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/40 p-5">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-danger"><AlertTriangle className="h-4 w-4" />全站還原</p>
      <p className="mb-4 text-sm text-muted-foreground">
        所有資料表會清空,換回這份備份的內容;備份之後所有人新增或修改的資料都會消失,登入中的使用者可能需要重新登入。
        系統會先把目前的資料自動另存一份「還原前備份」,必要時可以再還原回來。只在系統資料損毀時使用。
      </p>
      <div className="flex items-end gap-3">
        <Field label="確認:請輸入「全站還原」" className="flex-1">
          <input className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button variant="danger" disabled={busy || confirm !== '全站還原'} onClick={run}>{busy ? '還原中…' : '全站還原'}</Button>
      </div>
      <div className="mt-3"><Notice msg={msg} /></div>
    </Card>
  );
}

export default function Backups() {
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.backups().then(({ backups }) => setList(backups)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    setSummary(null);
    if (!selected) return;
    api.backupSummary(selected).then(setSummary).catch((e) => setError(e.message));
  }, [selected]);

  async function download(path) {
    try { await api.downloadBackup(path); } catch (e) { setError(e.message); }
  }

  return (
    <>
      <PageTitle>備份還原</PageTitle>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <Card className="mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">備份檔</th>
              <th className="px-3 py-2.5 font-medium">類型</th>
              <th className="px-3 py-2.5 font-medium">建立時間</th>
              <th className="px-3 py-2.5 font-medium">大小</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!list ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">載入中…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">還沒有備份</td></tr>
            ) : list.map((b) => (
              <tr key={b.path} className={selected === b.path ? 'bg-muted/60' : ''}>
                <td className="num px-4 py-2.5">{b.name}</td>
                <td className="px-3 py-2.5">{b.folder === 'weekly' ? <Badge tone="ink">每週備份</Badge> : b.folder === 'beta-end' ? <Badge tone="green">測試結束備份</Badge> : <Badge tone="amber">還原前備份</Badge>}</td>
                <td className="num px-3 py-2.5 text-muted-foreground">{fmtDateTime(b.created_at)}</td>
                <td className="num px-3 py-2.5 text-muted-foreground">{kb(b.size)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant={selected === b.path ? 'primary' : 'outline'} onClick={() => setSelected(selected === b.path ? null : b.path)}><Eye className="h-4 w-4" />查看與還原</Button>
                    <Button variant="outline" onClick={() => download(b.path)}><Download className="h-4 w-4" />下載</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selected && (
        !summary ? (
          <p className="text-sm text-muted-foreground">讀取備份內容中…</p>
        ) : (
          <div className="space-y-4">
            <Card className="p-5">
              <p className="mb-1 font-medium">備份內容</p>
              <p className="mb-4 text-sm text-muted-foreground">{selected}・備份時間 {fmtDateTime(summary.created_at)}</p>
              <CountGrid counts={summary.counts} />
            </Card>
            <UserRestore key={`u-${selected}`} path={selected} users={summary.users} onDone={load} />
            <FullRestore key={`a-${selected}`} path={selected} onDone={load} />
          </div>
        )
      )}
    </>
  );
}

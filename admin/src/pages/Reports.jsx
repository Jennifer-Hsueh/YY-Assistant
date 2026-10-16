import { useEffect, useState } from 'react';
import { EyeOff, Eye, Trash2, Flag } from 'lucide-react';
import { api } from '../api';
import { BOARD_LABEL, WISH_LABEL, fmtDateTime } from '../labels';
import { Badge, Button, Card, PageTitle, Segmented } from '../ui';

function Author({ a }) {
  if (!a) return <span className="text-muted-foreground">(已刪除的使用者)</span>;
  return <span>{a.username || '(未設定稱呼)'} <span className="text-muted-foreground">· {a.email}</span></span>;
}

function PostBody({ post }) {
  return (
    <>
      {post.title && <p className="mb-1 font-medium">{post.title}</p>}
      <p className="whitespace-pre-wrap break-words text-sm">{post.content}</p>
    </>
  );
}

function ReportCard({ post, onChanged, onRemoved }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn) {
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const toggle = () => run(async () => { const { post: p } = await api.setHidden(post.id, !post.hidden); onChanged({ ...post, ...p, ...(p.hidden ? {} : { report_count: 0, reports: [] }) }); });
  const remove = () => run(async () => { await api.deletePost(post.id); onRemoved(post.id); });

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="ink">{BOARD_LABEL[post.board] || post.board}</Badge>
        {post.hidden ? <Badge tone="red">已隱藏</Badge> : <Badge tone="amber">待處理</Badge>}
        {post.anonymous && <Badge>匿名發文</Badge>}
        <span className="ml-1"><Author a={post.author} /></span>
        <span className="num ml-auto text-xs text-muted-foreground">{fmtDateTime(post.created_at)}</span>
      </div>
      <div className="mb-4 rounded-lg bg-muted/40 p-3"><PostBody post={post} /></div>

      {post.report_count > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Flag className="h-4 w-4 text-danger" />檢舉 {post.report_count} 次</p>
          <ul className="space-y-1 text-sm">
            {post.reports.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="num shrink-0 text-xs leading-5 text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                <span className="min-w-0">{r.reason || <span className="text-muted-foreground">(未填原因)</span>}<span className="ml-2 text-xs text-muted-foreground">— {r.reporter?.email || '未知'}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirm ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/40 p-3">
          <p className="flex-1 text-sm">刪除後無法復原(含留言與回應),確定嗎?</p>
          <Button variant="danger" disabled={busy} onClick={remove}>確認刪除</Button>
          <Button variant="outline" onClick={() => setConfirm(false)}>取消</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {post.hidden ? (
            <Button variant="outline" disabled={busy} onClick={toggle}><Eye className="h-4 w-4" />恢復顯示(清除檢舉)</Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={toggle}><EyeOff className="h-4 w-4" />隱藏</Button>
          )}
          <Button variant="outline" className="text-danger" disabled={busy} onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" />刪除</Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}

function ReportList({ initialFilter }) {
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPosts(null);
    api.reports(filter).then(({ posts }) => setPosts(posts)).catch((e) => setError(e.message));
  }, [filter]);

  return (
    <>
      <div className="mb-4">
        <Segmented value={filter} onChange={setFilter} options={[['all', '全部'], ['reported', '待處理'], ['hidden', '已隱藏']]} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!posts ? (
        <p className="text-sm text-muted-foreground">載入中…</p>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">目前沒有需要處理的文章 🎉</Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <ReportCard
              key={p.id}
              post={p}
              onChanged={(np) => setPosts((list) => list.map((x) => (x.id === np.id ? np : x)))}
              onRemoved={(id) => setPosts((list) => list.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </>
  );
}

function WishList() {
  const [status, setStatus] = useState('all');
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPosts(null);
    api.wishes(status).then(({ posts }) => setPosts(posts)).catch((e) => setError(e.message));
  }, [status]);

  async function change(post, value) {
    setError('');
    try {
      const { post: p } = await api.setWishStatus(post.id, value || null);
      setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, wish_status: p.wish_status } : x)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Segmented value={status} onChange={setStatus} options={[['all', '全部'], ['none', '未標記'], ...Object.entries(WISH_LABEL)]} />
      </div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {!posts ? (
        <p className="text-sm text-muted-foreground">載入中…</p>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">沒有許願</Card>
      ) : (
        <Card className="divide-y divide-border">
          {posts.map((p) => (
            <div key={p.id} className="flex gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <PostBody post={p} />
                <p className="mt-1.5 text-xs text-muted-foreground"><Author a={p.author} /> · {fmtDateTime(p.created_at)}{p.hidden && <span className="ml-2 text-danger">(已隱藏)</span>}</p>
              </div>
              <select
                className="h-9 w-28 shrink-0 rounded-lg border border-border bg-card px-2 text-sm"
                value={p.wish_status || ''}
                onChange={(e) => change(p, e.target.value)}
              >
                <option value="">未標記</option>
                {Object.entries(WISH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export default function Reports({ initial }) {
  const [tab, setTab] = useState(initial?.tab === 'wish' ? 'wish' : 'reports');
  return (
    <>
      <PageTitle>檢舉與社群</PageTitle>
      <div className="mb-5 flex gap-6 border-b border-border text-sm">
        {[['reports', '檢舉處理'], ['wish', '許願池狀態']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-2.5 ${tab === k ? 'border-ink font-medium text-ink' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>
      {tab === 'reports' ? <ReportList initialFilter={initial?.filter} /> : <WishList />}
    </>
  );
}

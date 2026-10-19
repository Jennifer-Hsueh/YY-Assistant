import { useEffect, useState } from 'react';
import { Plus, Star, User, Globe, X } from 'lucide-react';
import { api } from '../api';
import { fmtDateTime, splitLocal, joinLocal, typeDate, typeTime } from '../labels';
import { Badge, Button, Card, Field, Notice, PageTitle, inputCls } from '../ui';

const blank = { title: '', content: '', is_important: false, pub_date: '', pub_time: '', target: null };

// 發放對象:公開或單一使用者(用 Email / 稱呼搜尋)
function TargetPicker({ target, onChange }) {
  const [mode, setMode] = useState(target ? 'user' : 'public');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => { setMode(target ? 'user' : 'public'); }, [target]);
  useEffect(() => {
    if (mode !== 'user' || !q.trim()) { setResults([]); return undefined; }
    const timer = setTimeout(() => {
      api.users({ q: q.trim() }).then(({ users }) => setResults(users.slice(0, 6))).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, mode]);

  const pickMode = (m) => { setMode(m); if (m === 'public') onChange(null); };
  const btn = (on) => `flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${on ? 'bg-ink text-white' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div>
      <span className="mb-1 block text-xs text-muted-foreground">發放對象</span>
      <div className="mb-2 flex rounded-lg border border-border p-1">
        <button type="button" className={btn(mode === 'public')} onClick={() => pickMode('public')}><Globe className="h-3.5 w-3.5" />公開</button>
        <button type="button" className={btn(mode === 'user')} onClick={() => pickMode('user')}><User className="h-3.5 w-3.5" />單一使用者</button>
      </div>
      {mode === 'user' && (target ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <User className="h-4 w-4 text-ink" />
          <span className="min-w-0 flex-1 truncate">{target.username || '(未設定稱呼)'} <span className="text-muted-foreground">· {target.email}</span></span>
          <button type="button" title="重新選擇" onClick={() => onChange(null)} className="text-muted-foreground hover:text-danger"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="relative">
          <input className={inputCls} placeholder="輸入 Email 或稱呼搜尋" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              {results.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => { onChange({ id: u.id, email: u.email, username: u.username }); setQ(''); }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {u.username || '(未設定稱呼)'} <span className="text-muted-foreground">· {u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Announcements({ initial = {} }) {
  const [list, setList] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = 新增
  const [form, setForm] = useState(blank);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => api.announcements().then(({ announcements }) => setList(announcements)).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);

  // 從故障通報按「發公告回覆」過來:預先帶入發放對象與標題
  useEffect(() => {
    if (!initial.to) return;
    api.users({ q: initial.to }).then(({ users }) => {
      const u = users.find((x) => x.id === initial.to);
      setForm((f) => ({ ...f, title: initial.title || f.title, target: u ? { id: u.id, email: u.email, username: u.username } : f.target }));
    }).catch(() => {});
  }, [initial.to]);

  function startNew() {
    setEditingId(null);
    setForm(blank);
    setConfirmDelete(false);
    setMsg(null);
  }
  function pick(a) {
    setEditingId(a.id);
    setForm({ title: a.title, content: a.content || '', is_important: !!a.is_important, ...(() => { const { date, time } = splitLocal(a.published_at); return { pub_date: date, pub_time: time }; })(), target: a.target_user_id ? { id: a.target_user_id, ...(a.target || {}) } : null });
    setConfirmDelete(false);
    setMsg(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    // 輸入的是本機時間(24 小時制),轉成 ISO 再送出(伺服器在 UTC)
    const when = joinLocal(form.pub_date, form.pub_time);
    if (when.error) { setMsg({ ok: false, text: when.error }); setBusy(false); return; }
    const { target, pub_date, pub_time, ...rest } = form;
    const body = { ...rest, target_user_id: target?.id || null, published_at: when.iso };
    try {
      if (editingId) {
        const { announcement } = await api.updateAnnouncement(editingId, body);
        pick(announcement);
        setMsg({ ok: true, text: '已更新' });
      } else {
        const { announcement } = await api.createAnnouncement(body);
        pick(announcement);
        setMsg({ ok: true, text: '已發布' });
      }
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteAnnouncement(editingId);
      startNew();
      setMsg({ ok: true, text: '已刪除' });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const now = new Date().toISOString();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <>
      <PageTitle right={<Button onClick={startNew}><Plus className="h-4 w-4" />新增公告</Button>}>公告管理</PageTitle>
      <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-6">
        <Card className="overflow-hidden">
          {!list ? (
            <p className="p-6 text-sm text-muted-foreground">載入中…</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">還沒有公告</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => pick(a)} className={`w-full px-5 py-3.5 text-left transition-colors ${editingId === a.id ? 'bg-muted' : 'hover:bg-muted/40'}`}>
                    <div className="mb-1 flex items-center gap-2">
                      {a.is_important && <Star className="h-4 w-4 shrink-0 fill-warn text-warn" />}
                      {a.target_user_id && <Badge tone="ink">給 {a.target?.username || a.target?.email || '使用者'}</Badge>}
                      <p className="truncate font-medium">{a.title}</p>
                      <span className="ml-auto shrink-0">{a.published_at > now ? <Badge tone="amber">排程中</Badge> : <Badge tone="green">已發布</Badge>}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{a.content}</p>
                    <p className="num mt-1 text-xs text-muted-foreground">{fmtDateTime(a.published_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="sticky top-8 p-5">
          <p className="mb-4 font-medium">{editingId ? '編輯公告' : '新增公告'}</p>
          <form onSubmit={save} className="space-y-3">
            <Field label="標題">
              <input className={inputCls} value={form.title} maxLength={120} onChange={set('title')} required />
            </Field>
            <Field label="內容">
              <textarea className={`${inputCls} h-48 resize-y py-2`} value={form.content} maxLength={5000} onChange={set('content')} required />
            </Field>
            <TargetPicker target={form.target} onChange={(target) => setForm((f) => ({ ...f, target }))} />
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">發布時間(空白 = 立即發布;設定未來時間 = 排程)</span>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} num flex-1`}
                  inputMode="numeric"
                  placeholder="yyyy/mm/dd"
                  value={form.pub_date}
                  onChange={(e) => setForm((f) => ({ ...f, pub_date: typeDate(e.target.value) }))}
                />
                <input
                  className={`${inputCls} num w-24`}
                  inputMode="numeric"
                  placeholder="HH:MM"
                  value={form.pub_time}
                  onChange={(e) => setForm((f) => ({ ...f, pub_time: typeTime(e.target.value) }))}
                />
              </div>
            </div>
            <label className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <input type="checkbox" className="mt-0.5" checked={form.is_important} onChange={set('is_important')} />
              <span>
                重要公告
                <span className="block text-xs text-muted-foreground">會在首頁顯示橫幅,直到看過或關閉{form.target ? '(只有這位使用者看得到)' : ''}</span>
              </span>
            </label>
            {confirmDelete ? (
              <div className="space-y-2 rounded-lg border border-danger/40 p-3">
                <p className="text-sm">確定要刪除這則公告嗎?</p>
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" disabled={busy} onClick={remove}>確認刪除</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>取消</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={busy}>{editingId ? '儲存變更' : '發布'}</Button>
                {editingId && <Button variant="outline" onClick={() => setConfirmDelete(true)}>刪除</Button>}
              </div>
            )}
            <Notice msg={msg} />
          </form>
        </Card>
      </div>
    </>
  );
}

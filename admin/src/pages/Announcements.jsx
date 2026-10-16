import { useEffect, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { api } from '../api';
import { fmtDateTime, toLocalInput } from '../labels';
import { Badge, Button, Card, Field, Notice, PageTitle, inputCls } from '../ui';

const blank = { title: '', content: '', is_important: false, published_at: '' };

export default function Announcements() {
  const [list, setList] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = 新增
  const [form, setForm] = useState(blank);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => api.announcements().then(({ announcements }) => setList(announcements)).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);

  function startNew() {
    setEditingId(null);
    setForm(blank);
    setConfirmDelete(false);
    setMsg(null);
  }
  function pick(a) {
    setEditingId(a.id);
    setForm({ title: a.title, content: a.content || '', is_important: !!a.is_important, published_at: toLocalInput(a.published_at) });
    setConfirmDelete(false);
    setMsg(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    // datetime-local 是本機時間,轉成 ISO 再送出(伺服器在 UTC)
    const body = { ...form, published_at: form.published_at ? new Date(form.published_at).toISOString() : null };
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
            <Field label="發布時間(空白 = 立即發布;設定未來時間 = 排程)">
              <input type="datetime-local" className={inputCls} value={form.published_at} onChange={set('published_at')} />
            </Field>
            <label className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <input type="checkbox" className="mt-0.5" checked={form.is_important} onChange={set('is_important')} />
              <span>
                重要公告
                <span className="block text-xs text-muted-foreground">會在使用者首頁顯示橫幅,直到他看過或關閉</span>
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

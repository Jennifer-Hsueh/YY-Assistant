import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cake, Heart, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { usePlan } from '../context/PlanContext';
import CalendarSubNav from '../components/CalendarSubNav';
import EventPeople from '../components/EventPeople';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';

const TEXT = {
  zh: {
    add: '新增紀念日', edit: '編輯紀念日', title: '名稱，例如：交往紀念日', date: '日期', note: '備註（選填）',
    remind: '提醒', reminds: { none: '不提醒', day: '當天', day_1: '前 1 天＋當天', day_3: '前 3 天＋當天', day_7: '前 7 天＋當天' },
    save: '儲存', create: '新增', cancel: '取消', del: '刪除', leave: '不再參加',
    delConfirm: (shared) => (shared ? '刪除後，所有參與者的這個紀念日都會一起刪除。' : '確定刪除這個紀念日？'),
    leaveConfirm: '確定不再參加？這個紀念日會從你的清單移除。',
    empty: '還沒有紀念日，新增一個重要的日子吧 💝',
    today: '就是今天！', left: (n) => `還有 ${n} 天`, nth: (n) => `${n} 週年`,
    birthdays: '好友生日', noBirthdays: '好友還沒有公開生日', mine: '設定我的生日與提醒',
    invite: (from, t) => `${from || '好友'} 邀請你一起記住「${t}」`, join: '加入', decline: '婉拒',
  },
  en: {
    add: 'Add anniversary', edit: 'Edit anniversary', title: 'Name, e.g. Our anniversary', date: 'Date', note: 'Note (optional)',
    remind: 'Remind', reminds: { none: 'Off', day: 'On the day', day_1: '1 day before + on the day', day_3: '3 days before + on the day', day_7: '7 days before + on the day' },
    save: 'Save', create: 'Add', cancel: 'Cancel', del: 'Delete', leave: 'Leave',
    delConfirm: (shared) => (shared ? 'This will delete it for everyone.' : 'Delete this anniversary?'),
    leaveConfirm: 'Leave this anniversary? It will be removed from your list.',
    empty: 'No anniversaries yet. Add a day that matters 💝',
    today: 'Today!', left: (n) => `${n} days to go`, nth: (n) => `${n} year${n > 1 ? 's' : ''}`,
    birthdays: "Friends' birthdays", noBirthdays: 'No friends have shared their birthday yet', mine: 'Set my birthday and reminders',
    invite: (from, t) => `${from || 'A friend'} invited you to "${t}"`, join: 'Join', decline: 'Decline',
  },
};
const empty = { title: '', date: '', remind: 'day', note: '' };

export default function Anniversaries() {
  const { t, language } = useLanguage();
  const T = TEXT[language] || TEXT.zh;
  const { can } = usePlan();
  const writable = can('calendar');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // 正在編輯的紀念日
  const [open, setOpen] = useState(false);
  const [inviteIds, setInviteIds] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.listAnniversaries().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  function startAdd() { setEditing(null); setForm(empty); setInviteIds([]); setConfirm(false); setOpen(true); }
  function startEdit(a) {
    setEditing(a); setForm({ title: a.title, date: a.date, remind: a.remind, note: a.note || '' });
    setInviteIds([]); setConfirm(false); setOpen(true);
    if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function close() { setOpen(false); setEditing(null); setConfirm(false); }

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); await load(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault();
    const body = { ...form, ...(inviteIds.length ? { invite_ids: inviteIds } : {}) };
    if (await run(() => (editing ? api.updateAnniversary(editing.id, body) : api.createAnniversary(body)))) close();
  }
  const fmt = (ymd) => ymd.replace(/-/g, '/');
  const md = (s) => s.replace('-', '/');

  const form_ = open && (
    <Card className="mb-3">
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-2">
          <p className="text-sm font-medium">{editing ? T.edit : T.add}</p>
          <Input required maxLength={50} placeholder={T.title} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="flex items-center gap-2">
            <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="min-w-0 flex-1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-xs text-muted-foreground">🔔 {T.remind}</span>
            <select value={form.remind} onChange={(e) => setForm({ ...form, remind: e.target.value })} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
              {Object.entries(T.reminds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <textarea rows={2} placeholder={T.note} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          <EventPeople event={editing ? { ...editing, shared: editing.members.length > 0 } : null} selected={inviteIds} onChange={setInviteIds}
            removeMember={(uid) => api.removeAnniversaryMember(editing.id, uid)} onRemoved={async () => { const d = await api.listAnniversaries(); setData(d); setEditing(d.anniversaries.find((x) => x.id === editing.id) || null); }} />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={busy}>{editing ? T.save : T.create}</Button>
            {editing && <Button type="button" variant="outline" onClick={() => setConfirm(true)}>{editing.is_owner ? T.del : T.leave}</Button>}
            <Button type="button" variant="outline" onClick={close}>{T.cancel}</Button>
          </div>
          {confirm && editing && (
            <div className="space-y-2 rounded-md border border-border p-2">
              <p className="text-sm">{editing.is_owner ? T.delConfirm(editing.members.some((m) => m.status === 'active')) : T.leaveConfirm}</p>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" className="flex-1" disabled={busy} onClick={async () => { if (await run(() => api.deleteAnniversary(editing.id))) close(); }}>{editing.is_owner ? T.del : T.leave}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirm(false)}>{T.cancel}</Button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-calendar)', '--ring': 'var(--module-calendar)' }}>
      <h1 className="page-title-row page-title mb-3 text-lg font-semibold">{t('sub_anniversaries')}</h1>
      <CalendarSubNav />

      {data?.invites?.map((inv) => (
        <div key={inv.id} className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <Heart className="h-4 w-4 shrink-0" style={{ color: 'var(--module-calendar)' }} />
          <span className="min-w-0 flex-1 text-sm">{T.invite(inv.from, inv.title)}</span>
          <Button size="sm" disabled={busy} onClick={() => run(() => api.acceptAnniversary(inv.id))}>{T.join}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api.declineAnniversary(inv.id))}>{T.decline}</Button>
        </div>
      ))}

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
        <div className="md:order-2 md:sticky md:top-6">
          {writable && !open && <Button className="mb-3 w-full" onClick={startAdd}>{T.add}</Button>}
          {form_}
          <Card className="mb-3">
            <CardContent className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Cake className="h-4 w-4" style={{ color: 'var(--module-calendar)' }} />{T.birthdays}</p>
              {!data ? null : data.birthdays.length === 0 ? <p className="text-sm text-muted-foreground">{T.noBirthdays}</p> : (
                <ul className="space-y-1.5 text-sm">
                  {data.birthdays.map((b) => (
                    <li key={b.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate">{b.name || '—'}</span>
                      <span className="font-amount text-xs text-muted-foreground">{md(b.md)}</span>
                      <span className={`w-20 text-right text-xs ${b.days_left === 0 ? 'font-medium' : 'text-muted-foreground'}`} style={b.days_left === 0 ? { color: 'var(--module-calendar)' } : undefined}>{b.days_left === 0 ? T.today : T.left(b.days_left)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/settings" className="mt-3 block text-xs text-muted-foreground underline">{T.mine}</Link>
            </CardContent>
          </Card>
        </div>

        <div className="md:order-1">
          {data && data.anniversaries.length === 0 && <p className="px-1 text-sm text-muted-foreground">{T.empty}</p>}
          <div className="space-y-2">
            {data?.anniversaries.map((a) => (
              <Card key={a.id} onClick={() => startEdit(a)} className={`cursor-pointer transition-colors hover:bg-muted/50 ${editing?.id === a.id ? 'bg-muted' : ''}`}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--module-calendar) 14%, transparent)' }}>
                    <span className="font-amount text-lg font-semibold leading-none" style={{ color: 'var(--module-calendar)' }}>{a.days_left === 0 ? '🎉' : a.days_left}</span>
                    {a.days_left > 0 && <span className="text-[10px] text-muted-foreground">{language === 'en' ? 'days' : '天'}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {a.title}
                      {a.members.some((m) => m.status === 'active') && <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(a.next)}{a.years > 0 && ` · ${T.nth(a.years)}`} · {a.days_left === 0 ? T.today : T.left(a.days_left)}
                    </p>
                  </div>
                  {a.remind !== 'none' && <span className="text-xs">🔔</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

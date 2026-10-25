import { useEffect, useState } from 'react';
import { Check, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';

const TEXT = {
  zh: {
    invite: '邀請好友', creator: '建立者', invited: '邀請中', none: '還沒有好友，可以到「社群 → 好友」加好友',
    unnamed: '未設定稱呼', from: (n, t, d) => `${n || '好友'} 邀請你參加「${t}」${d}`, join: '參加', decline: '婉拒',
  },
  en: {
    invite: 'Invite friends', creator: 'Creator', invited: 'Invited', none: 'No friends yet. Add friends in Community → Friends.',
    unnamed: 'No name', from: (n, t, d) => `${n || 'A friend'} invited you to "${t}" ${d}`, join: 'Join', decline: 'Decline',
  },
};
const useT = () => { const { language } = useLanguage(); return [TEXT[language] || TEXT.zh, language]; };

let friendsCache = null;
function useFriends() {
  const [friends, setFriends] = useState(friendsCache);
  useEffect(() => {
    if (friendsCache) return;
    api.getFriends().then((d) => { friendsCache = d.friends; setFriends(d.friends); }).catch(() => setFriends([]));
  }, []);
  return friends;
}

// 行程表單裡的參與者:目前的人(建立者可移出)+勾選要邀請的好友
// removeMember:移出成員的 API(預設是行程;紀念日傳自己的)
export default function EventPeople({ event, selected, onChange, onRemoved, removeMember }) {
  const [T] = useT();
  const friends = useFriends();
  const [busy, setBusy] = useState(false);
  const name = (n) => n || T.unnamed;
  const inEvent = new Set([event?.owner?.id, ...(event?.members || []).map((m) => m.id)].filter(Boolean));
  const candidates = (friends || []).filter((f) => !inEvent.has(f.id));
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  async function remove(id) {
    setBusy(true);
    try { await (removeMember ? removeMember(id) : api.removeEventMember(event.id, id)); onRemoved?.(id); } catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-2.5">
      {(event?.shared || event?.members?.length > 0) && (
        <ul className="space-y-1 text-sm">
          <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /><span className="flex-1">{name(event.owner?.name)}</span><span className="text-xs text-muted-foreground">{T.creator}</span></li>
          {event.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 pl-5">
              <span className={`flex-1 ${m.status === 'active' ? '' : 'text-muted-foreground'}`}>{name(m.name)}</span>
              {m.status === 'invited' && <span className="text-xs text-muted-foreground">{T.invited}</span>}
              {event.is_owner && <button type="button" disabled={busy} aria-label="✕" onClick={() => remove(m.id)} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{T.invite}</p>
      {friends && (candidates.length ? (
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((f) => {
            const on = selected.includes(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggle(f.id)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                {on && <Check className="h-3 w-3" />}{name(f.name)}
              </button>
            );
          })}
        </div>
      ) : <p className="text-xs text-muted-foreground">{T.none}</p>)}
    </div>
  );
}

// 收到的行程邀請(行事曆頁、首頁)
export function EventInvites({ onChanged }) {
  const [T, language] = useT();
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => api.listEventInvites().then((d) => setInvites(d.invites)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!invites.length) return null;
  const when = (iso) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString(language === 'en' ? 'en-US' : 'zh-TW', { month: 'numeric', day: 'numeric' });
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return t === '00:00' ? date : `${date} ${t}`;
  };
  async function answer(inv, yes) {
    setBusy(true);
    try { await (yes ? api.acceptEventInvite(inv.event_id) : api.declineEventInvite(inv.event_id)); } catch { /* 邀請可能已取消 */ }
    await load(); setBusy(false); onChanged?.();
  }
  return (
    <div className="mb-3 space-y-2">
      {invites.map((inv) => (
        <div key={inv.event_id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <span className="text-base">📅</span>
          <span className="min-w-0 flex-1 text-sm">{T.from(inv.from, inv.title, when(inv.start_at))}</span>
          <Button size="sm" disabled={busy} onClick={() => answer(inv, true)}>{T.join}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => answer(inv, false)}>{T.decline}</Button>
        </div>
      ))}
    </div>
  );
}

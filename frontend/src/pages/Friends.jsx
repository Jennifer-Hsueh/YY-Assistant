import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Share2, MoreHorizontal } from 'lucide-react';
import { api } from '../lib/api';
import { isNative } from '../lib/platform';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';

const WEB_URL = 'https://yy-assistant-front.onrender.com';

const TEXT = {
  zh: {
    myCode: '我的好友碼',
    copy: '複製', copied: '已複製', qr: 'QR Code', share: '分享邀請',
    shareText: (code) => `一起用 YY手帳 吧！我的好友碼是 ${code}`,
    newCode: '換一組好友碼',
    newCodeConfirm: '換了之後，舊的好友碼和 QR Code 就不能用了（已經是好友的不受影響）。確定要換嗎？',
    noName: '還沒設定稱呼，好友會看到「未設定稱呼」。',
    goSettings: '到設定填寫',
    add: '加好友', codePlaceholder: '輸入對方的好友碼', send: '送出',
    sent: (n) => `已送出邀請給 ${n}`, nowFriends: (n) => `你和 ${n} 成為好友了！`,
    incoming: '好友邀請', accept: '接受', decline: '拒絕',
    friends: '好友', none: '還沒有好友，把好友碼分享給朋友吧 🦫',
    outgoing: '已送出的邀請', cancelReq: '取消',
    blocked: '封鎖名單', unblock: '解除封鎖',
    since: (d) => `${d} 成為好友`,
    unfriend: '解除好友', block: '封鎖', report: '檢舉',
    unfriendConfirm: (n) => `確定要和 ${n} 解除好友嗎？`,
    blockConfirm: (n) => `封鎖後，${n} 會從好友中移除，也無法再用好友碼找到你。`,
    reportTitle: (n) => `檢舉 ${n}`,
    reportHint: '檢舉後會同時封鎖對方，管理員會查看。',
    reportPlaceholder: '請簡單說明原因（選填）',
    confirm: '確定', cancel: '取消',
    unnamed: '未設定稱呼',
    error: '讀取失敗，請稍後再試',
  },
  en: {
    myCode: 'My friend code',
    copy: 'Copy', copied: 'Copied', qr: 'QR code', share: 'Share invite',
    shareText: (code) => `Join me on YY Assistant! My friend code is ${code}`,
    newCode: 'Get a new code',
    newCodeConfirm: 'Your old code and QR code will stop working (existing friends stay). Get a new one?',
    noName: 'You have not set a display name. Friends will see "No name".',
    goSettings: 'Set it in Settings',
    add: 'Add a friend', codePlaceholder: "Enter your friend's code", send: 'Send',
    sent: (n) => `Invite sent to ${n}`, nowFriends: (n) => `You and ${n} are now friends!`,
    incoming: 'Friend requests', accept: 'Accept', decline: 'Decline',
    friends: 'Friends', none: 'No friends yet. Share your code with a friend 🦫',
    outgoing: 'Sent invites', cancelReq: 'Cancel',
    blocked: 'Blocked', unblock: 'Unblock',
    since: (d) => `Friends since ${d}`,
    unfriend: 'Remove friend', block: 'Block', report: 'Report',
    unfriendConfirm: (n) => `Remove ${n} from your friends?`,
    blockConfirm: (n) => `${n} will be removed from your friends and can no longer find you by your code.`,
    reportTitle: (n) => `Report ${n}`,
    reportHint: 'Reporting also blocks this person. An admin will review it.',
    reportPlaceholder: 'Tell us briefly what happened (optional)',
    confirm: 'Confirm', cancel: 'Cancel',
    unnamed: 'No name',
    error: 'Could not load. Please try again later.',
  },
};

export function useFriendText() {
  const { language } = useLanguage();
  return TEXT[language] || TEXT.zh;
}

export const formatCode = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '');
export const inviteLink = (code) => `${isNative ? WEB_URL : window.location.origin}/add-friend?code=${code}`;

function Section({ title, children }) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-medium">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function Person({ name, sub, children, onClick }) {
  const T = useFriendText();
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium" style={{ color: 'var(--ink)' }}>
        {(name || '?').slice(0, 1)}
      </span>
      {onClick ? (
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <p className={`truncate text-sm ${name ? '' : 'text-muted-foreground'}`}>{name || T.unnamed}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </button>
      ) : (
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${name ? '' : 'text-muted-foreground'}`}>{name || T.unnamed}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      )}
      {children}
    </li>
  );
}

// 好友的更多操作:解除好友、封鎖、檢舉(都要再確認一次)
function FriendActions({ f, onDone, setError }) {
  const T = useFriendText();
  const [mode, setMode] = useState(null); // menu | unfriend | block | report
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const name = f.name || T.unnamed;
  async function run(fn) {
    setBusy(true);
    try { await fn(); setMode(null); onDone(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!mode) {
    return <button type="button" aria-label="⋯" onClick={() => setMode('menu')} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center" onClick={() => setMode(null)}>
      <div className="w-full max-w-sm rounded-xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {mode === 'menu' && (
          <div className="space-y-2">
            <p className="mb-1 text-sm font-medium">{name}</p>
            <Button variant="outline" className="w-full" onClick={() => setMode('unfriend')}>{T.unfriend}</Button>
            <Button variant="outline" className="w-full" onClick={() => setMode('block')}>{T.block}</Button>
            <Button variant="outline" className="w-full text-destructive" onClick={() => setMode('report')}>{T.report}</Button>
            <Button variant="ghost" className="w-full" onClick={() => setMode(null)}>{T.cancel}</Button>
          </div>
        )}
        {(mode === 'unfriend' || mode === 'block') && (
          <div className="space-y-3">
            <p className="text-sm">{mode === 'unfriend' ? T.unfriendConfirm(name) : T.blockConfirm(name)}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode(null)}>{T.cancel}</Button>
              <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => run(() => (mode === 'unfriend' ? api.removeFriend(f.id) : api.blockUser(f.id)))}>{T.confirm}</Button>
            </div>
          </div>
        )}
        {mode === 'report' && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{T.reportTitle(name)}</p>
            <p className="text-xs text-muted-foreground">{T.reportHint}</p>
            <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={300} placeholder={T.reportPlaceholder} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode(null)}>{T.cancel}</Button>
              <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => run(() => api.reportUser(f.id, reason))}>{T.report}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Friends({ onOpen }) {
  const T = useFriendText();
  const { language } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const load = () => api.getFriends().then((d) => { setData(d); setError(''); }).catch(() => setError(T.error));
  useEffect(() => { load(); }, []);

  const myCode = data?.me.code;
  useEffect(() => {
    if (!myCode) return;
    QRCode.toDataURL(inviteLink(myCode), { margin: 1, width: 360, color: { dark: '#33415c', light: '#ffffff' } }).then(setQr).catch(() => setQr(null));
  }, [myCode]);

  const fmtDay = (iso) => new Date(iso).toLocaleDateString(language === 'en' ? 'en-US' : 'zh-TW');

  async function act(fn, after) {
    setBusy(true); setError(''); setMsg('');
    try { const r = await fn(); if (after) after(r); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(formatCode(myCode)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }
  async function share() {
    const text = T.shareText(formatCode(myCode));
    const url = inviteLink(myCode);
    if (navigator.share) { try { await navigator.share({ text, url }); } catch { /* 取消分享 */ } return; }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  function send(e) {
    e.preventDefault();
    if (!code.trim()) return;
    act(() => api.requestFriend(code), (r) => {
      const n = r.user.name || T.unnamed;
      setMsg(r.status === 'friend' ? T.nowFriends(n) : T.sent(n));
      setCode('');
    });
  }

  if (!data) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{error || '…'}</p>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <Section title={T.myCode}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-amount text-2xl font-semibold tracking-wider" style={{ color: 'var(--ink)' }}>{formatCode(myCode)}</span>
          <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? T.copied : T.copy}</Button>
          <Button variant="outline" size="sm" onClick={() => setShowQr((v) => !v)}><QrCode className="h-4 w-4" />{T.qr}</Button>
          <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" />{T.share}</Button>
        </div>
        {showQr && qr && <img src={qr} alt="QR code" className="mx-auto mt-4 h-44 w-44 rounded-lg border border-border" />}
        {!data.me.name && (
          <p className="mt-3 text-xs text-muted-foreground">{T.noName} <Link to="/settings" className="underline">{T.goSettings}</Link></p>
        )}
        {confirmNew ? (
          <div className="mt-3 space-y-2 rounded-md bg-muted/60 p-3">
            <p className="text-xs">{T.newCodeConfirm}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmNew(false)}>{T.cancel}</Button>
              <Button size="sm" disabled={busy} onClick={() => act(() => api.newFriendCode(), () => setConfirmNew(false))}>{T.confirm}</Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmNew(true)} className="mt-3 text-xs text-muted-foreground underline">{T.newCode}</button>
        )}
      </Section>

      <Section title={T.add}>
        <form onSubmit={send} className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={T.codePlaceholder} maxLength={12} autoCapitalize="characters" autoComplete="off" />
          <Button type="submit" disabled={busy || !code.trim()}>{T.send}</Button>
        </form>
        {msg && <p className="mt-2 text-sm" style={{ color: 'var(--ink)' }}>{msg}</p>}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </Section>

      {data.incoming.length > 0 && (
        <Section title={`${T.incoming}（${data.incoming.length}）`}>
          <ul className="divide-y divide-border">
            {data.incoming.map((f) => (
              <Person key={f.id} name={f.name}>
                <Button size="sm" disabled={busy} onClick={() => act(() => api.acceptFriend(f.id))}>{T.accept}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api.removeFriend(f.id))}>{T.decline}</Button>
              </Person>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`${T.friends}${data.friends.length ? `（${data.friends.length}）` : ''}`}>
        {data.friends.length === 0 ? <p className="text-sm text-muted-foreground">{T.none}</p> : (
          <ul className="divide-y divide-border">
            {data.friends.map((f) => (
              <Person key={f.id} name={f.name} sub={T.since(fmtDay(f.since))} onClick={onOpen ? () => onOpen(f) : undefined}>
                <FriendActions f={f} onDone={load} setError={setError} />
              </Person>
            ))}
          </ul>
        )}
      </Section>

      {data.outgoing.length > 0 && (
        <Section title={T.outgoing}>
          <ul className="divide-y divide-border">
            {data.outgoing.map((f) => (
              <Person key={f.id} name={f.name}>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api.removeFriend(f.id))}>{T.cancelReq}</Button>
              </Person>
            ))}
          </ul>
        </Section>
      )}

      {data.blocked.length > 0 && (
        <div className="mb-3 px-1">
          <button type="button" onClick={() => setShowBlocked((v) => !v)} className="text-xs text-muted-foreground underline">{T.blocked}（{data.blocked.length}）</button>
          {showBlocked && (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card px-3">
              {data.blocked.map((f) => (
                <Person key={f.id} name={f.name}>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api.unblockUser(f.id))}>{T.unblock}</Button>
                </Person>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

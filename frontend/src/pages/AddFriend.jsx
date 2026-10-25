import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { savePendingInvite } from '../lib/pendingInvite';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { HelloBrand } from '../components/BrandMark';
import { formatCode } from './Friends';

const TEXT = {
  zh: {
    hello: '交個朋友吧！', want: '加為好友？', add: '加為好友', accept: '接受好友邀請',
    outgoing: '已送出邀請，等對方接受', friend: '你們已經是好友了', self: '這是你自己的好友碼',
    notFound: '找不到這組好友碼，可能已經換新的了', goFriends: '查看好友', unnamed: '未設定稱呼',
    sent: '已送出邀請！', nowFriends: '你們成為好友了！',
  },
  en: {
    hello: "Let's be friends!", want: 'Add as a friend?', add: 'Add friend', accept: 'Accept request',
    outgoing: 'Invite sent. Waiting for them to accept', friend: 'You are already friends', self: 'This is your own friend code',
    notFound: 'No one found with this code. It may have been changed', goFriends: 'See friends', unnamed: 'No name',
    sent: 'Invite sent!', nowFriends: 'You are now friends!',
  },
};

export default function AddFriend() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const code = (params.get('code') || '').toUpperCase();
  const { language } = useLanguage();
  const T = TEXT[language] || TEXT.zh;
  const [info, setInfo] = useState(null); // { user, relation } | 'notfound'
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !code) return;
    api.lookupFriend(code).then(setInfo).catch((e) => (e.status === 404 || e.code === 'NOT_FOUND' ? setInfo('notfound') : setError(e.message)));
  }, [user, code]);

  // 還沒登入:記住好友碼,先去註冊(已有帳號可以在註冊頁切到登入)
  if (!user) {
    savePendingInvite(code);
    return <Navigate to="/register" replace />;
  }

  async function add() {
    setBusy(true); setError('');
    try {
      const r = await api.requestFriend(code);
      setDone(r.status === 'friend' ? T.nowFriends : T.sent);
      setInfo((i) => ({ ...i, relation: r.status }));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const name = info && info !== 'notfound' ? (info.user.name || T.unnamed) : '';
  const rel = info && info !== 'notfound' ? info.relation : null;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
      <div className="mb-6"><HelloBrand greeting={T.hello} lang={language} /></div>
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 p-6 text-center">
          {!info && !error && <p className="text-sm text-muted-foreground">…</p>}
          {info === 'notfound' && <p className="text-sm">{T.notFound}</p>}
          {info && info !== 'notfound' && (
            <>
              <div>
                <span className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xl font-medium" style={{ color: 'var(--ink)' }}>{name.slice(0, 1)}</span>
                <p className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>{name}</p>
                <p className="font-amount text-xs text-muted-foreground">{formatCode(code)}</p>
              </div>
              {done && <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{done}</p>}
              {!done && rel === 'none' && <Button className="w-full" disabled={busy} onClick={add}>{T.add}</Button>}
              {!done && rel === 'incoming' && <Button className="w-full" disabled={busy} onClick={add}>{T.accept}</Button>}
              {!done && rel === 'outgoing' && <p className="text-sm text-muted-foreground">{T.outgoing}</p>}
              {!done && rel === 'friend' && <p className="text-sm text-muted-foreground">{T.friend}</p>}
              {rel === 'self' && <p className="text-sm text-muted-foreground">{T.self}</p>}
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Link to="/community/friends" className="inline-block text-sm underline">{T.goFriends}</Link>
        </CardContent>
      </Card>
    </div>
  );
}

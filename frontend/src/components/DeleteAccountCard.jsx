import { useState } from 'react';
import { UserX, AlertTriangle } from 'lucide-react';
import { api, clearSession } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';

// 設定 → 刪除帳號:輸入密碼與確認文字後刪除帳號與所有資料(無法復原)
export default function DeleteAccountCard({ t }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keyword = t('del_keyword');

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setText('');
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.deleteAccount(password);
      sessionStorage.setItem('yy_account_deleted', '1');
      clearSession();
    } catch (err) {
      setError(err.code === 'wrong_password' ? t('del_wrong_password') : err.code === 'admin_account' ? t('del_admin') : err.status === 429 ? err.message : t('del_failed'));
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="mt-3">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <UserX className="h-4 w-4" />
              {t('del_title')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('del_desc')}</p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>{t('del_button')}</Button>
        </CardContent>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={close}>
          <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-2 font-semibold text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('del_confirm_title')}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('del_point_data')}</li>
              <li>{t('del_point_undo')}</li>
              <li>{t('del_point_payment')}</li>
            </ul>
            <Input className="mt-3" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('del_password')} />
            <Input className="mt-2" value={text} onChange={(e) => setText(e.target.value)} placeholder={`${t('del_type_prefix')}${keyword}`} />
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button type="submit" variant="destructive" className="flex-1" disabled={!password || text.trim() !== keyword || busy}>
                {busy ? t('loading') : t('del_submit')}
              </Button>
              <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={close}>{t('cancel')}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

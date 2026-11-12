import { useState } from 'react';
import { Mail } from 'lucide-react';
import { api } from '../lib/api';
import { isValidEmail } from '../lib/email';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';

// 設定 → 帳戶資訊:顯示 Email,點「修改」輸入新 Email＋目前密碼
export default function ChangeEmailCard({ t, language }) {
  const { user, updateUser } = useAuth();
  const en = language === 'en';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const email = form.email.trim();
    if (!isValidEmail(email)) return setStatus({ ok: false, text: en ? 'Please enter a valid email address' : 'Email 格式不正確' });
    setSaving(true);
    setStatus(null);
    try {
      const { user: next, token } = await api.changeEmail(email, form.password);
      updateUser(next, token);
      setForm({ email: '', password: '' });
      setOpen(false);
      setStatus({ ok: true, text: en ? 'Email updated. Use the new email next time you log in.' : 'Email 已更新，下次請用新的 Email 登入' });
    } catch (err) {
      setStatus({ ok: false, text: err.code === 'wrong_password' ? t('pw_wrong_current') : err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">{user?.email}</span>
        </p>
        {!open && <button type="button" onClick={() => { setOpen(true); setStatus(null); }} className="shrink-0 text-xs text-muted-foreground underline">{t('mode_edit')}</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <Input type="email" autoComplete="email" placeholder={en ? 'New email' : '新的 Email'} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input type="password" autoComplete="current-password" placeholder={t('pw_current')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? t('loading') : t('save')}</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); setStatus(null); }}>{t('cancel')}</Button>
          </div>
        </form>
      )}
      {status && <p className={`mt-2 text-xs ${status.ok ? 'text-green-600' : 'text-destructive'}`}>{status.text}</p>}
    </div>
  );
}

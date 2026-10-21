import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';

// 設定 → 修改密碼(點了才展開)
export default function ChangePasswordCard({ t }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [status, setStatus] = useState(null); // { ok, text }
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.next.length < 8) return setStatus({ ok: false, text: t('pw_too_short') });
    if (form.next !== form.confirm) return setStatus({ ok: false, text: t('pw_mismatch') });
    setSaving(true);
    setStatus(null);
    try {
      await api.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setStatus({ ok: true, text: t('pw_changed') });
      setOpen(false);
    } catch (err) {
      setStatus({ ok: false, text: err.status === 429 ? err.message : err.code === 'wrong_password' ? t('pw_wrong_current') : t('pw_failed') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium"><KeyRound className="h-4 w-4" />{t('pw_title')}</p>
          {!open && <button type="button" onClick={() => { setOpen(true); setStatus(null); }} className="text-xs text-muted-foreground underline">{t('mode_edit')}</button>}
        </div>
        {open && (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <Input type="password" autoComplete="current-password" placeholder={t('pw_current')} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required />
            <Input type="password" autoComplete="new-password" placeholder={t('pw_new')} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required />
            <Input type="password" autoComplete="new-password" placeholder={t('pw_confirm')} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? t('loading') : t('save')}</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); setStatus(null); }}>{t('cancel')}</Button>
            </div>
          </form>
        )}
        {status && <p className={`mt-2 text-xs ${status.ok ? 'text-green-600' : 'text-destructive'}`}>{status.text}</p>}
      </CardContent>
    </Card>
  );
}

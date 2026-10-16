import { useState } from 'react';
import { api, setToken } from '../api';
import { Button, Card, Field, inputCls } from '../ui';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token } = await api.login(email.trim(), password);
      setToken(token);
      try {
        const { admin } = await api.me();
        onLogin(admin);
      } catch (err) {
        setToken(null);
        setError(err.status === 403 ? '這個帳號沒有管理權限' : '無法確認管理權限,請稍後再試');
      }
    } catch (err) {
      setError(err.status === 401 ? 'Email 或密碼錯誤' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/round-logo.png" alt="" className="h-11 w-11 rounded-full" />
          <div>
            <h1 className="text-lg font-semibold text-ink">YY手帳 管理後台</h1>
            <p className="text-xs text-muted-foreground">請用管理員帳號登入</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="密碼">
            <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? '登入中…' : '登入'}</Button>
        </form>
      </Card>
    </div>
  );
}

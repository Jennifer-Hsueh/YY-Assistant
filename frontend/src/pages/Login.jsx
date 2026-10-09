import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // 因登入過期被導回時,顯示提示;登入後回到原本的頁面
  const [expired] = useState(() => {
    const v = sessionStorage.getItem('yy_session_expired') === '1';
    sessionStorage.removeItem('yy_session_expired');
    return v;
  });
  const from = location.state?.from?.pathname || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">登入</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {expired && !error && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">登入已逾時，請重新登入</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '登入中…' : '登入'}
            </Button>
            <p className="text-center text-sm">
              <Link to="/forgot-password" className="text-muted-foreground underline">
                忘記密碼?
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              還沒有帳號?{' '}
              <Link to="/register" className="text-foreground underline">
                註冊
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

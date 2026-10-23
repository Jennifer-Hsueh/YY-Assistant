import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { isNative } from '../lib/platform';
import { HelloBrand } from '../components/BrandMark';
import { useAuthText, AuthLangSwitch } from '../lib/authText';
import { useBeta } from '../lib/useBeta';

export default function Login() {
  const beta = useBeta();
  const { A, language } = useAuthText();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // 因登入過期被導回時,顯示提示;登入後回到原本的頁面
  const [expired] = useState(() => {
    const v = sessionStorage.getItem('yy_session_expired') === '1';
    sessionStorage.removeItem('yy_session_expired');
    return v;
  });
  const [disabled] = useState(() => {
    const v = sessionStorage.getItem('yy_account_disabled') === '1';
    sessionStorage.removeItem('yy_account_disabled');
    return v;
  });
  const [deleted] = useState(() => {
    const v = sessionStorage.getItem('yy_account_deleted') === '1';
    sessionStorage.removeItem('yy_account_deleted');
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-16">
      <AuthLangSwitch />
      {/* LOGO(網頁版點了回入口頁) */}
      <Link to={isNative ? '#' : '/'} onClick={(e) => isNative && e.preventDefault()} className="mb-6" aria-label="YY手帳 Assistant">
        <HelloBrand greeting={A.hello} beta={!!beta?.active} lang={language} />
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{A.login}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {expired && !error && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{A.expired}</p>}
            {deleted && !error && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{A.deleted}</p>}
            {disabled && !error && <p className="rounded-md bg-muted px-3 py-2 text-sm text-destructive">{A.disabled}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="email">{A.email}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{A.password}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? A.loggingIn : A.login}
            </Button>
            <p className="text-center text-sm">
              <Link to="/forgot-password" className="text-muted-foreground underline">
                {A.forgot}
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {A.noAccount}{' '}
              <Link to="/register" className="text-foreground underline">
                {A.register}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

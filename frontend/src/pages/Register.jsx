import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { isNative } from '../lib/platform';
import { HelloBrand } from '../components/BrandMark';
import { ConsentCheck } from '../components/TermsConsentModal';
import { LegalOverlay } from './Legal';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [doc, setDoc] = useState(null);
  const [beta, setBeta] = useState(null);
  useEffect(() => { api.getBeta().then(({ beta: b }) => setBeta(b)).catch(() => {}); }, []);
  const full = !!beta?.full;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!agreed) return;
    setError('');
    setLoading(true);
    try {
      await register(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4">
      {/* LOGO(網頁版點了回入口頁) */}
      <Link to={isNative ? '#' : '/'} onClick={(e) => isNative && e.preventDefault()} className="mb-6" aria-label="YY手帳 Assistant">
        <HelloBrand greeting="一起來記錄吧！" beta />
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">建立帳號</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {full && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">目前 {beta.limit} 位測試名額已滿，謝謝你的關注</p>}
            {!full && beta && <p className="text-xs text-muted-foreground">測試版開放 {beta.limit} 位測試者，還有 {beta.remaining} 個名額</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">密碼 Password（至少 8 碼）</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <ConsentCheck checked={agreed} onChange={setAgreed} onOpen={setDoc} />
            <Button type="submit" disabled={loading || !agreed || full} className="w-full">
              {loading ? '建立中…' : '註冊'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              已經有帳號?{' '}
              <Link to="/login" className="text-foreground underline">登入</Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <LegalOverlay doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

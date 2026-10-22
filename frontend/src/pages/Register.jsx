import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { isNative } from '../lib/platform';
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
      {/* 網頁版:LOGO 連回入口頁 */}
      {!isNative && (
        <Link to="/" className="mb-5 flex items-center gap-2" aria-label="YY手帳 首頁">
          <img src="/round-logo.png" alt="" className="h-12 w-12" />
          <span className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>YY手帳</span>
        </Link>
      )}
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">建立帳號</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" disabled={loading || !agreed} className="w-full">
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

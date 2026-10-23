import { useState } from 'react';
import { useBeta } from '../lib/useBeta';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { isNative } from '../lib/platform';
import { HelloBrand } from '../components/BrandMark';
import { useAuthText, AuthLangSwitch } from '../lib/authText';
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
  const beta = useBeta();
  const { A, language } = useAuthText();
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
      <AuthLangSwitch />
      {/* LOGO(網頁版點了回入口頁) */}
      <Link to={isNative ? '#' : '/'} onClick={(e) => isNative && e.preventDefault()} className="mb-6" aria-label="YY手帳 Assistant">
        <HelloBrand greeting={A.helloNew} beta={!!beta?.active} lang={language} />
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{A.registerTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {full && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{A.betaFull(beta.limit)}</p>}
            {!full && beta?.active && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {A.betaInfo(beta.limit, beta.remaining)}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="email">{A.email}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{A.passwordNew}</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <ConsentCheck checked={agreed} onChange={setAgreed} onOpen={setDoc} />
            <Button type="submit" disabled={loading || !agreed || full} className="w-full">
              {loading ? A.registering : A.register}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {A.haveAccount}{' '}
              <Link to="/login" className="text-foreground underline">{A.login}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <LegalOverlay doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthText, AuthLangSwitch } from '../lib/authText';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';

export default function ForgotPassword() {
  const { A } = useAuthText();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(email);
      setMessage(res.message || A.sentFallback);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <AuthLangSwitch />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{A.forgotTitle}</CardTitle>
          <CardDescription>{A.forgotDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && <p className="text-sm text-green-600">{message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="email">{A.email}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? A.sending : A.sendLink}
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-muted-foreground underline">{A.backToLogin}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthText, AuthLangSwitch } from '../lib/authText';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

export default function ResetPassword() {
  const { A } = useAuthText();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(email, token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!email || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
        <p className="text-sm text-muted-foreground">
          {A.badLink}
          <Link to="/forgot-password" className="text-foreground underline"> {A.requestAgain}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <AuthLangSwitch />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{A.resetTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {done && <p className="text-sm text-green-600">{A.resetDone}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">{A.newPassword}</Label>
              <Input id="newPassword" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading || done} className="w-full">
              {loading ? A.resetting : A.reset}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

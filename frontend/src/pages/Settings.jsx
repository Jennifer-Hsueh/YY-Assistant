import { Settings as SettingsIcon, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { requestPushToken } from '../lib/firebase';
import { api } from '../lib/api';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export default function Settings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pushStatus, setPushStatus] = useState('idle');

  async function handleEnablePush() {
    setPushStatus('enabling');
    const token = await requestPushToken();
    if (!token) { setPushStatus('failed'); return; }
    try {
      await api.registerPushSubscription(token);
      setPushStatus('enabled');
    } catch (err) {
      console.error(err);
      setPushStatus('failed');
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <h1 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <SettingsIcon className="h-5 w-5" style={{ color: 'var(--ink)' }} />
        {t('nav_settings')}
      </h1>

      <Card className="mb-3">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">{t('settings_account')}</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            {user?.email}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">{t('settings_notifications')}</p>
          {pushStatus === 'enabled' ? (
            <p className="text-sm text-green-600">{t('rec_push_enabled')}</p>
          ) : (
            <Button size="sm" onClick={handleEnablePush} disabled={pushStatus === 'enabling'}>
              {pushStatus === 'enabling' ? t('rec_enabling') : t('rec_enable_push')}
            </Button>
          )}
          {pushStatus === 'failed' && <p className="mt-1 text-xs text-destructive">{t('rec_push_failed')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mail, Wallet, Calendar, User, Bug } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { requestPushToken } from '../lib/firebase';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';

function usePushPreference(storageKey) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(storageKey) === 'true');
  useEffect(() => {
    localStorage.setItem(storageKey, String(enabled));
  }, [enabled, storageKey]);
  return [enabled, setEnabled];
}

export default function Settings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pushStatus, setPushStatus] = useState('idle');
  const [ledgerPref, setLedgerPref] = usePushPreference('notif_pref_ledger');
  const [calendarPref, setCalendarPref] = usePushPreference('notif_pref_calendar');

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [profileError, setProfileError] = useState('');

  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ title: '', description: '' });
  const [reportStatus, setReportStatus] = useState('idle');

  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true);
      try {
        const { profile } = await api.getProfile();
        setProfile(profile);
        setUsernameDraft(profile.username || '');
      } catch (err) {
        console.error(err);
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, []);

  async function ensurePushRegistered() {
    if (pushStatus === 'enabled') return true;
    setPushStatus('enabling');
    const token = await requestPushToken();
    if (!token) { setPushStatus('failed'); return false; }
    try {
      await api.registerPushSubscription(token);
      setPushStatus('enabled');
      return true;
    } catch (err) {
      console.error(err);
      setPushStatus('failed');
      return false;
    }
  }

  async function toggleLedgerPref() {
    if (!ledgerPref) { const ok = await ensurePushRegistered(); if (!ok) return; }
    setLedgerPref((v) => !v);
  }

  async function toggleCalendarPref() {
    if (!calendarPref) { const ok = await ensurePushRegistered(); if (!ok) return; }
    setCalendarPref((v) => !v);
  }

  async function saveUsername() {
    setProfileError('');
    try {
      const { profile } = await api.updateProfile({ username: usernameDraft || null });
      setProfile(profile);
      setEditingUsername(false);
    } catch (err) {
      console.error(err);
      setProfileError(t('settings_profile_error'));
    }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!reportForm.title || !reportForm.description) return;
    setReportStatus('sending');
    try {
      await api.submitBugReport(reportForm);
      setReportStatus('sent');
      setReportForm({ title: '', description: '' });
    } catch (err) {
      console.error(err);
      setReportStatus('failed');
    }
  }

  const roleLabel = { user: t('settings_role_user'), admin: t('settings_role_admin'), tester: t('settings_role_tester') };
  const planLabel = { free: t('settings_plan_free'), ledger: t('settings_plan_ledger'), calendar: t('settings_plan_calendar'), full: t('settings_plan_full') };

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

      {/* 個人資訊 — 帳號名稱可編輯;身份/方案/付款日由後台設定,僅顯示 */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <User className="h-4 w-4" />
            {t('settings_profile')}
          </p>

          {profileLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : (
            <div className="space-y-2 text-sm">
              {profileError && <p className="text-red-500">{profileError}</p>}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('settings_username')}</span>
                {editingUsername ? (
                  <div className="flex flex-1 items-center gap-2 pl-4">
                    <Input value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} className="h-8" />
                    <Button size="sm" onClick={saveUsername}>{t('save')}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingUsername(false); setUsernameDraft(profile?.username || ''); }}>{t('cancel')}</Button>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    {profile?.username || '—'}
                    <button type="button" onClick={() => setEditingUsername(true)} className="text-xs text-muted-foreground underline">{t('mode_edit')}</button>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('settings_interface')}</span>
                <span className="text-xs text-muted-foreground">{t('settings_interface_placeholder')}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('settings_role')}</span>
                <span>{roleLabel[profile?.role] || profile?.role}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('settings_plan')}</span>
                <span>{planLabel[profile?.plan] || profile?.plan}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('settings_last_payment')}</span>
                <span>{profile?.last_payment_date || '—'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">{t('settings_notifications')}</p>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" style={{ color: 'var(--module-transactions)' }} />
              <span className="text-sm">{t('settings_push_ledger')}</span>
            </div>
            <Button size="sm" variant={ledgerPref ? 'default' : 'outline'} onClick={toggleLedgerPref} disabled={pushStatus === 'enabling'}>
              {ledgerPref ? t('rec_active') : t('rec_inactive')}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: 'var(--module-calendar)' }} />
              <span className="text-sm">{t('settings_push_calendar')}</span>
            </div>
            <Button size="sm" variant={calendarPref ? 'default' : 'outline'} onClick={toggleCalendarPref} disabled={pushStatus === 'enabling'}>
              {calendarPref ? t('rec_active') : t('rec_inactive')}
            </Button>
          </div>

          {pushStatus === 'failed' && <p className="text-xs text-destructive">{t('rec_push_failed')}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Bug className="h-4 w-4" />
              {t('settings_bug_report')}
            </p>
            {!reportOpen && (
              <button type="button" onClick={() => setReportOpen(true)} className="text-xs text-muted-foreground underline">{t('settings_bug_report_open')}</button>
            )}
          </div>

          {reportOpen && (
            <form onSubmit={submitReport} className="space-y-2">
              {reportStatus === 'sent' ? (
                <p className="text-sm text-green-600">{t('settings_bug_report_sent')}</p>
              ) : (
                <>
                  <Input
                    placeholder={t('settings_bug_report_title')}
                    value={reportForm.title}
                    onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                    required
                  />
                  <textarea
                    placeholder={t('settings_bug_report_desc')}
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    required
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  />
                  {reportStatus === 'failed' && <p className="text-xs text-destructive">{t('settings_bug_report_failed')}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={reportStatus === 'sending'}>
                      {reportStatus === 'sending' ? t('loading') : t('settings_bug_report_submit')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>{t('cancel')}</Button>
                  </div>
                </>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

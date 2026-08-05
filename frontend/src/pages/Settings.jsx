import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mail, Wallet, Calendar, User, Bug } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { requestPushToken } from '../lib/firebase';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

function usePushPreference(storageKey) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(storageKey) === 'true');
  useEffect(() => {
    localStorage.setItem(storageKey, String(enabled));
  }, [enabled, storageKey]);
  return [enabled, setEnabled];
}

export default function Settings() {
  const { user } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [pushStatus, setPushStatus] = useState('idle');
  const [ledgerPref, setLedgerPref] = usePushPreference('notif_pref_ledger');
  const [calendarPref, setCalendarPref] = usePushPreference('notif_pref_calendar');

  // 個人資訊
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', role: 'user', plan: 'free', last_payment_date: '' });
  const [profileError, setProfileError] = useState('');

  // 故障通報
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ title: '', description: '' });
  const [reportStatus, setReportStatus] = useState('idle');

  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true);
      try {
        const { profile } = await api.getProfile();
        setProfile(profile);
        setProfileForm({
          username: profile.username || '',
          role: profile.role || 'user',
          plan: profile.plan || 'free',
          last_payment_date: profile.last_payment_date || '',
        });
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

  async function saveProfile() {
    setProfileError('');
    try {
      const { profile } = await api.updateProfile({
        username: profileForm.username || null,
        role: profileForm.role,
        plan: profileForm.plan,
        last_payment_date: profileForm.last_payment_date || null,
      });
      setProfile(profile);
      setEditingProfile(false);
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

      {/* 帳號資訊(唯讀 Email) */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">{t('settings_account')}</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            {user?.email}
          </p>
        </CardContent>
      </Card>

      {/* 個人資訊 */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <User className="h-4 w-4" />
              {t('settings_profile')}
            </p>
            {!editingProfile && !profileLoading && (
              <button type="button" onClick={() => setEditingProfile(true)} className="text-xs text-muted-foreground underline">{t('mode_edit')}</button>
            )}
          </div>

          {profileLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : editingProfile ? (
            <div className="space-y-2">
              {profileError && <p className="text-sm text-red-500">{profileError}</p>}
              <div>
                <label className="text-xs text-muted-foreground">{t('settings_username')}</label>
                <Input value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('settings_interface_lang')}</label>
                <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                  <span>{language === 'zh' ? '中文' : 'English'}</span>
                  <button type="button" onClick={toggleLanguage} className="text-xs underline text-muted-foreground">{t('mode_edit')}</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('settings_role')}</label>
                <Select value={profileForm.role} onValueChange={(v) => setProfileForm({ ...profileForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t('settings_role_user')}</SelectItem>
                    <SelectItem value="admin">{t('settings_role_admin')}</SelectItem>
                    <SelectItem value="tester">{t('settings_role_tester')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('settings_plan')}</label>
                <Select value={profileForm.plan} onValueChange={(v) => setProfileForm({ ...profileForm, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">{t('settings_plan_free')}</SelectItem>
                    <SelectItem value="ledger">{t('settings_plan_ledger')}</SelectItem>
                    <SelectItem value="calendar">{t('settings_plan_calendar')}</SelectItem>
                    <SelectItem value="full">{t('settings_plan_full')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('settings_last_payment')}</label>
                <Input type="date" value={profileForm.last_payment_date} onChange={(e) => setProfileForm({ ...profileForm, last_payment_date: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" className="flex-1" onClick={saveProfile}>{t('save')}</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingProfile(false)}>{t('cancel')}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-sm">
              <p><span className="text-muted-foreground">{t('settings_username')}: </span>{profile?.username || '—'}</p>
              <p><span className="text-muted-foreground">{t('settings_interface_lang')}: </span>{language === 'zh' ? '中文' : 'English'}</p>
              <p><span className="text-muted-foreground">{t('settings_role')}: </span>{roleLabel[profile?.role] || profile?.role}</p>
              <p><span className="text-muted-foreground">{t('settings_plan')}: </span>{planLabel[profile?.plan] || profile?.plan}</p>
              <p><span className="text-muted-foreground">{t('settings_last_payment')}: </span>{profile?.last_payment_date || '—'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 通知設定 */}
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

      {/* 故障通報 */}
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

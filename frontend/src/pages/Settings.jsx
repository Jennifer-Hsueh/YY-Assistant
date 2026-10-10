import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mail, Wallet, Calendar, User, Bug, Trash2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { requestPushToken } from '../lib/firebase';
import { api } from '../lib/api';
import { applyTheme, getStoredTheme } from '../lib/theme';
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

const HOME_IMAGES = [
  null,
  '/home-images/yy-1.png',
  '/home-images/yy-2.png',
  '/home-images/yy-3.png',
  '/home-images/yy-4.png',
  '/home-images/yy-5.png',
  '/home-images/yy-6.png',
];

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

  const [clearOpen, setClearOpen] = useState(false);
  const [clearText, setClearText] = useState('');
  const [clearStatus, setClearStatus] = useState('idle');

  const [imageStatus, setImageStatus] = useState('idle');
  const [theme, setTheme] = useState(getStoredTheme);

  // 立即套用,再存到伺服器(Web 與 APP 共用同一個設定)
  async function selectTheme(name) {
    setTheme(applyTheme(name));
    try {
      const { profile } = await api.updateProfile({ theme: name });
      setProfile(profile);
    } catch (err) {
      console.error(err);
    }
  }

  async function selectImage(src) {
    setImageStatus('saving');
    try {
      const { profile } = await api.updateProfile({ home_image: src });
      setProfile(profile);
      setImageStatus('idle');
    } catch (err) {
      console.error(err);
      setImageStatus('failed');
    }
  }

  async function clearAllData() {
    setClearStatus('clearing');
    try {
      await api.clearAllData();
      setClearStatus('done');
      setClearOpen(false);
      setClearText('');
    } catch (err) {
      console.error(err);
      setClearStatus('failed');
    }
  }

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
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10">
      <h1 className="page-title-row page-title mb-4 flex items-center gap-2 text-lg font-semibold">
        <SettingsIcon className="h-5 w-5 md:hidden" style={{ color: 'var(--ink)' }} />
        {t('nav_settings')}
      </h1>

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
      <div>
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
                <div className="flex rounded-lg border border-border bg-card p-1 text-xs shadow-sm">
                  {[
                    { name: 'default', swatch: '#F5EFE3', label: t('settings_theme_default') },
                    { name: 'grey', swatch: '#2E3135', label: t('settings_theme_grey') },
                  ].map(({ name, swatch, label }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectTheme(name)}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${theme === name ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
                    >
                      <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: swatch }} />
                      {label}
                    </button>
                  ))}
                </div>
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
        <CardContent className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="h-4 w-4" />
            {t('settings_home_image')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {HOME_IMAGES.map((src) => {
              const selected = (profile?.home_image || null) === src;
              return (
                <button
                  key={src || 'default'}
                  type="button"
                  disabled={imageStatus === 'saving'}
                  onClick={() => selectImage(src)}
                  className={`flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted/40 p-1 transition-colors ${selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:bg-muted'}`}
                >
                  <img src={src || '/home-watermark-logo.png'} alt="" className="max-h-full max-w-full object-contain" />
                </button>
              );
            })}
          </div>
          {imageStatus === 'failed' && <p className="mt-2 text-xs text-destructive">{t('settings_home_image_failed')}</p>}
        </CardContent>
      </Card>
      </div>

      <div>
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

      <Card className="mt-3">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <Trash2 className="h-4 w-4" />
              {t('settings_clear_data')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('settings_clear_data_desc')}</p>
            {clearStatus === 'done' && <p className="mt-1 text-xs text-green-600">{t('settings_clear_done')}</p>}
          </div>
          <Button size="sm" variant="destructive" onClick={() => { setClearOpen(true); setClearStatus('idle'); setClearText(''); }}>
            {t('settings_clear_button')}
          </Button>
        </CardContent>
      </Card>

      {clearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => clearStatus !== 'clearing' && setClearOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-2 font-semibold text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('settings_clear_confirm_title')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t('settings_clear_confirm_body')}</p>
            <Input className="mt-3" value={clearText} onChange={(e) => setClearText(e.target.value)} placeholder={t('settings_clear_keyword')} />
            {clearStatus === 'failed' && <p className="mt-2 text-xs text-destructive">{t('settings_clear_failed')}</p>}
            <div className="mt-4 flex gap-2">
              <Button variant="destructive" className="flex-1" disabled={clearText !== t('settings_clear_keyword') || clearStatus === 'clearing'} onClick={clearAllData}>
                {clearStatus === 'clearing' ? t('loading') : t('settings_clear_button')}
              </Button>
              <Button variant="outline" className="flex-1" disabled={clearStatus === 'clearing'} onClick={() => setClearOpen(false)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

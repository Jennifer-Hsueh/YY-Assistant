import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Mail, Wallet, Calendar, User, Bug, Trash2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { requestPushToken, pushPermissionGranted } from '../lib/firebase';
import { api } from '../lib/api';
import { applyTheme, getStoredTheme } from '../lib/theme';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import DataTransferCard from '../components/DataTransferCard';
import ChangePasswordCard from '../components/ChangePasswordCard';
import DeleteAccountCard from '../components/DeleteAccountCard';
import MoodCard from '../components/MoodCard';
import { useIsDesktop } from '../lib/useIsDesktop';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import { COUNTRY_CODES, countryName } from '../lib/helplines';
import { usePlan } from '../context/PlanContext';
import { PlanCard, LockedArea, askUpgrade } from '../components/PlanNotice';


const HOME_IMAGES = [
  null,
  '/home-images/yy-1.png',
  '/home-images/yy-2.png',
  '/home-images/yy-3.png',
  '/home-images/yy-4.png',
  '/home-images/yy-5.png',
  '/home-images/yy-6.png',
  '/home-images/yy-7.png',
  '/home-images/yy-8.png',
  '/home-images/yy-9.png',
  '/home-images/yy-10.png',
  '/home-images/yy-11.png',
  '/home-images/yy-12.png',
];
// 縮圖(約 200px 高),點了才載入完整圖案預覽
const thumbOf = (src) => (src ? src.replace('/home-images/', '/home-images/thumbs/') : '/home-watermark-logo.png');

export default function Settings() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isDesktop = useIsDesktop();
  const { can } = usePlan();
  const [pushStatus, setPushStatus] = useState('idle');
  // 通知偏好存在伺服器(換手機或重新安裝也會保留)
  const [ledgerPref, setLedgerPref] = useState(false);
  const [calendarPref, setCalendarPref] = useState(false);

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
  const [previewSrc, setPreviewSrc] = useState(undefined); // undefined = 沒有開啟預覽
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

  async function saveCountry(country) {
    setProfileError('');
    try {
      const { profile } = await api.updateProfile({ country });
      setProfile(profile);
    } catch (err) {
      console.error(err);
      setProfileError(t('settings_profile_error'));
    }
  }

  async function selectImage(src) {
    setImageStatus('saving');
    try {
      const { profile } = await api.updateProfile({ home_image: src });
      setProfile(profile);
      setImageStatus('idle');
      setPreviewSrc(undefined);
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
        // 開關顯示「伺服器設定 且 這台裝置已註冊推播」;這台還沒授權通知時顯示關閉
        const granted = await pushPermissionGranted().catch(() => false);
        setLedgerPref(granted && profile.notify_ledger !== false);
        setCalendarPref(granted && profile.notify_calendar !== false);
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

  async function savePref(field, value, setter) {
    setter(value);
    try {
      const { profile } = await api.updateProfile({ [field]: value });
      setProfile(profile);
    } catch (err) {
      console.error(err);
      setter(!value);
    }
  }

  async function toggleLedgerPref() {
    if (!ledgerPref) { const ok = await ensurePushRegistered(); if (!ok) return; }
    savePref('notify_ledger', !ledgerPref, setLedgerPref);
  }

  async function toggleCalendarPref() {
    if (!calendarPref) { const ok = await ensurePushRegistered(); if (!ok) return; }
    savePref('notify_calendar', !calendarPref, setCalendarPref);
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

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10">
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
          <p className="mt-2 flex gap-4 pl-6 text-xs text-muted-foreground">
            <Link to="/help" className="underline">{t('nav_help')}</Link>
            <Link to="/terms" className="underline">使用條款</Link>
            <Link to="/privacy" className="underline">隱私權政策</Link>
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

              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">{t('settings_country')}</span>
                <Select value={profile?.country || 'none'} onValueChange={(v) => saveCountry(v === 'none' ? null : v)}>
                  <SelectTrigger className="h-8 w-auto min-w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('settings_country_none')}</SelectItem>
                    {COUNTRY_CODES.map((c) => <SelectItem key={c} value={c}>{countryName(c, language)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('settings_role')}</span>
                <span>{roleLabel[profile?.role] || profile?.role}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('settings_last_payment')}</span>
                <span>{profile?.last_payment_date || '—'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PlanCard />

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
                  onClick={() => (can('home_image') ? setPreviewSrc(src) : askUpgrade('home_image'))}
                  className={`flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted/40 p-1 transition-colors ${selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:bg-muted'}`}
                >
                  <img src={thumbOf(src)} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                </button>
              );
            })}
          </div>
          {imageStatus === 'failed' && <p className="mt-2 text-xs text-destructive">{t('settings_home_image_failed')}</p>}
        </CardContent>
      </Card>

      {!isDesktop && <LockedArea feature="mood"><MoodCard t={t} /></LockedArea>}

      {/* 點縮圖跳出完整圖案預覽,確認後才選用 */}
      {previewSrc !== undefined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => imageStatus !== 'saving' && setPreviewSrc(undefined)}>
          <div className="w-full max-w-xs rounded-2xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-80 items-center justify-center rounded-xl bg-muted/40 p-3">
              <img src={previewSrc || '/home-watermark-logo.png'} alt="" className="max-h-full max-w-full object-contain" />
            </div>
            {(profile?.home_image || null) === previewSrc && (
              <p className="mt-2 text-center text-xs text-muted-foreground">{t('settings_home_image_current')}</p>
            )}
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" disabled={imageStatus === 'saving'} onClick={() => selectImage(previewSrc)}>
                {imageStatus === 'saving' ? t('loading') : t('settings_home_image_use')}
              </Button>
              <Button variant="outline" className="flex-1" disabled={imageStatus === 'saving'} onClick={() => setPreviewSrc(undefined)}>{t('cancel')}</Button>
            </div>
          </div>
        </div>
      )}


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
            <Button size="sm" variant={ledgerPref ? 'default' : 'outline'} onClick={() => (can('notifications') ? toggleLedgerPref() : askUpgrade('notifications'))} disabled={pushStatus === 'enabling'}>
              {ledgerPref ? t('rec_active') : t('rec_inactive')}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: 'var(--module-calendar)' }} />
              <span className="text-sm">{t('settings_push_calendar')}</span>
            </div>
            <Button size="sm" variant={calendarPref ? 'default' : 'outline'} onClick={() => (can('notifications') ? toggleCalendarPref() : askUpgrade('notifications'))} disabled={pushStatus === 'enabling'}>
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

      <div className="mt-3">
        <ChangePasswordCard t={t} />
      </div>

      <DataTransferCard t={t} />

      <Card>
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

      <DeleteAccountCard t={t} />

      {/* 本日心情:網頁版在右欄最下面;手機版在首頁圖片下面 */}
      {isDesktop && (
        <div className="mt-3">
          <LockedArea feature="mood"><MoodCard t={t} /></LockedArea>
        </div>
      )}

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

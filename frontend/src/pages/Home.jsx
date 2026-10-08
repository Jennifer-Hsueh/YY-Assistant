import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Calendar, Megaphone, Users, Settings as SettingsIcon, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';

const blocks = [
  { to: '/transactions', Icon: Wallet, titleKey: 'nav_ledger', subtitleKey: 'home_ledger_subtitle', color: 'var(--module-transactions)' },
  { to: '/calendar', Icon: Calendar, titleKey: 'nav_calendar', subtitleKey: 'home_calendar_subtitle', color: 'var(--module-calendar)' },
  { to: '/community', Icon: Users, titleKey: 'nav_community', subtitleKey: 'home_community_subtitle', color: 'var(--module-accounts)' },
  { to: '/settings', Icon: SettingsIcon, titleKey: 'nav_settings', subtitleKey: 'home_settings_subtitle', color: 'var(--ink)' },
];

export default function Home() {
  const { t } = useLanguage();
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnn, setLoadingAnn] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [{ announcements }, { profile }] = await Promise.all([
          api.listAnnouncements(),
          api.getProfile(),
        ]);
        setAnnouncements(announcements.slice(0, 4));
        setProfile(profile);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAnn(false);
      }
    }
    load();
  }, []);

  const displayName = profile?.username || profile?.email?.split('@')[0] || '';

  return (
    <div className="relative mx-auto max-w-xl px-4 pt-4 pb-24 md:max-w-4xl md:px-8 md:py-10">
      {/* 浮水印插圖 — 放大 3 倍、更淡,拿掉外層 overflow-hidden 避免被裁切 */}
<img
  src="/home-watermark-logo.png"
  alt=""
  className="pointer-events-none fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-5 w-[280px] opacity-[0.09] md:absolute md:bottom-[-30px] md:right-[-8px] md:w-[340px]"
  style={{ maxWidth: 'none' }}
/>

      <h1 className="mb-1 font-semibold" style={{ fontSize: '18.5px' }}>{t('nav_home')}</h1>
      {displayName && (
        <p className="mb-3 text-muted-foreground md:mb-5" style={{ fontSize: '15.4px' }}>{t('home_welcome_prefix')}{displayName}{t('home_welcome_suffix')}</p>
      )}

      <Link to="/announcements" className="mb-3 block md:mb-5">
        <Card
          className="border-none"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(--module-recurring) 6%, white), color-mix(in srgb, var(--module-recurring) 20%, white))` }}
        >
          <CardContent className="p-3 md:p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[1.3125rem] font-medium" style={{ color: 'var(--module-recurring)' }}>
              <Megaphone className="h-4 w-4" />
              {t('ann_latest')}
            </p>
            {loadingAnn ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : announcements.length === 0 ? (
              <p className="text-[0.975rem] text-muted-foreground">{t('ann_empty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {announcements.map((a) => (
                  <li key={a.id} className="truncate text-xs text-foreground">
                    <span className="text-muted-foreground">{a.published_at.slice(0, 10)}</span> · {a.title}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Link>

      <div className="grid gap-3 md:grid-cols-2 md:gap-5">
        {blocks.map(({ to, Icon, titleKey, subtitleKey, color }) => (
          <Link key={to} to={to} className="block h-full">
            <Card
              className="h-full border-none transition-transform active:scale-[0.99]"
              style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, white), color-mix(in srgb, ${color} 20%, white))` }}
            >
              <CardContent className="flex items-center gap-4 p-4 md:p-5">
                <div className="flex h-12 w-12 shrink-0 md:h-16 md:w-16 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: 'white' }}>
                  <Icon className="h-6 w-6 md:h-8 md:w-8" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[1.2rem] font-medium" style={{ color }}>{t(titleKey)}</p>
                  <p className="truncate text-[0.975rem] text-muted-foreground">{t(subtitleKey)}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0" style={{ color }} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

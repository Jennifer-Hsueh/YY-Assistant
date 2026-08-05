import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Calendar, Megaphone, Users, Settings as SettingsIcon, ChevronRight, Feather, Coffee, Leaf, Sparkles, BookOpen } from 'lucide-react';
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

  useEffect(() => {
    async function load() {
      try {
        const { announcements } = await api.listAnnouncements();
        setAnnouncements(announcements.slice(0, 3));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAnn(false);
      }
    }
    load();
  }, []);

  return (
    <div className="relative mx-auto max-w-xl px-4 py-6 pb-24">
      <Feather className="pointer-events-none absolute left-0 top-14 h-16 w-16 -rotate-12 opacity-[0.08]" style={{ color: 'var(--ink)' }} />
      <Leaf className="pointer-events-none absolute right-1 top-24 h-16 w-16 rotate-12 opacity-[0.08]" style={{ color: 'var(--income)' }} />
      <Sparkles className="pointer-events-none absolute left-2 top-1/2 h-14 w-14 -rotate-6 opacity-[0.08]" style={{ color: 'var(--highlight)' }} />
      <BookOpen className="pointer-events-none absolute right-0 bottom-32 h-16 w-16 rotate-6 opacity-[0.08]" style={{ color: 'var(--module-calendar)' }} />
      <Coffee className="pointer-events-none absolute bottom-4 left-4 h-20 w-20 -rotate-6 opacity-[0.08]" style={{ color: 'var(--expense)' }} />

      <h1 className="mb-6 text-lg font-semibold">{t('nav_home')}</h1>

      {/* 公告直接顯示在首頁 */}
      <Link to="/announcements" className="mb-5 block">
        <Card
          className="border-none"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(--module-recurring) 6%, white), color-mix(in srgb, var(--module-recurring) 20%, white))` }}
        >
          <CardContent className="p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--module-recurring)' }}>
              <Megaphone className="h-4 w-4" />
              {t('nav_announcements')}
            </p>
            {loadingAnn ? (
              <p className="text-xs text-muted-foreground">{t('loading')}</p>
            ) : announcements.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('ann_empty')}</p>
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

      <div className="space-y-5">
        {blocks.map(({ to, Icon, titleKey, subtitleKey, color }) => (
          <Link key={to} to={to} className="block">
            <Card
              className="border-none transition-transform active:scale-[0.99]"
              style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, white), color-mix(in srgb, ${color} 20%, white))` }}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: 'white' }}>
                  <Icon className="h-8 w-8" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium" style={{ color }}>{t(titleKey)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t(subtitleKey)}</p>
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

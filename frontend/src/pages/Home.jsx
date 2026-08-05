import { Link } from 'react-router-dom';
import { Wallet, Calendar, Megaphone, Users, Settings as SettingsIcon, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';

const blocks = [
  {
    to: '/transactions',
    Icon: Wallet,
    titleKey: 'nav_ledger',
    subtitleKey: 'home_ledger_subtitle',
    color: 'var(--module-transactions)',
  },
  {
    to: '/calendar',
    Icon: Calendar,
    titleKey: 'nav_calendar',
    subtitleKey: 'home_calendar_subtitle',
    color: 'var(--module-calendar)',
  },
  {
    to: '/announcements',
    Icon: Megaphone,
    titleKey: 'nav_announcements',
    subtitleKey: 'home_announcements_subtitle',
    color: 'var(--module-recurring)',
  },
  {
    to: '/community',
    Icon: Users,
    titleKey: 'nav_community',
    subtitleKey: 'home_community_subtitle',
    color: 'var(--module-accounts)',
  },
  {
    to: '/settings',
    Icon: SettingsIcon,
    titleKey: 'nav_settings',
    subtitleKey: 'home_settings_subtitle',
    color: 'var(--ink)',
  },
];

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <h1 className="mb-4 text-lg font-semibold">{t('nav_home')}</h1>

      <div className="space-y-3">
        {blocks.map(({ to, Icon, titleKey, subtitleKey, color }) => (
          <Link key={to} to={to}>
            <Card
              className="border-none transition-transform active:scale-[0.99]"
              style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, white), color-mix(in srgb, ${color} 20%, white))` }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'white' }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium" style={{ color }}>{t(titleKey)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t(subtitleKey)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color }} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

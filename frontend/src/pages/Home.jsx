import { Link } from 'react-router-dom';
import { Wallet, Calendar, Megaphone, Users, Settings as SettingsIcon, ChevronRight, Feather, Coffee, Leaf, Sparkles, BookOpen } from 'lucide-react';
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
    <div className="relative mx-auto max-w-xl px-4 py-6 pb-24">
      {/* 裝飾插圖 — 放在頁面邊角空白處,不疊在區塊上 */}
      <Feather className="pointer-events-none absolute left-0 top-14 h-9 w-9 -rotate-12 opacity-[0.08]" style={{ color: 'var(--ink)' }} />
      <Leaf className="pointer-events-none absolute right-1 top-24 h-8 w-8 rotate-12 opacity-[0.08]" style={{ color: 'var(--income)' }} />
      <Sparkles className="pointer-events-none absolute left-2 top-1/2 h-7 w-7 -rotate-6 opacity-[0.08]" style={{ color: 'var(--highlight)' }} />
      <BookOpen className="pointer-events-none absolute right-0 bottom-32 h-9 w-9 rotate-6 opacity-[0.08]" style={{ color: 'var(--module-calendar)' }} />
      <Coffee className="pointer-events-none absolute bottom-4 left-4 h-10 w-10 -rotate-6 opacity-[0.08]" style={{ color: 'var(--expense)' }} />

      <h1 className="mb-6 text-lg font-semibold">{t('nav_home')}</h1>

      <div className="space-y-5">
        {blocks.map(({ to, Icon, titleKey, subtitleKey, color }) => (
          <Link key={to} to={to}>
            <Card
              className="border-none transition-transform active:scale-[0.99]"
              style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, white), color-mix(in srgb, ${color} 20%, white))` }}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-sm"
                  style={{ backgroundColor: 'white' }}
                >
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

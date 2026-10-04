import { Home as HomeIcon, Wallet, Calendar, Users, Settings } from 'lucide-react';

export const navTabs = [
  { to: '/', key: 'nav_home', Icon: HomeIcon, color: 'var(--ink)', end: true },
  { to: '/transactions', key: 'nav_ledger', Icon: Wallet, color: 'var(--module-transactions)' },
  { to: '/calendar', key: 'nav_calendar', Icon: Calendar, color: 'var(--module-calendar)' },
  { to: '/community', key: 'nav_community', Icon: Users, color: 'var(--module-accounts)' },
  { to: '/settings', key: 'nav_settings', Icon: Settings, color: 'var(--ink)' },
];

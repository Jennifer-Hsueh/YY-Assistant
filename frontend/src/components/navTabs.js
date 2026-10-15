import { Home as HomeIcon, Wallet, Calendar, Users, Settings, NotebookPen } from 'lucide-react';

export const navTabs = [
  { to: '/', key: 'nav_home', Icon: HomeIcon, color: 'var(--ink)', end: true },
  { to: '/transactions', key: 'nav_ledger', Icon: Wallet, color: 'var(--module-transactions)', match: ['/recurring-money', '/accounts', '/categories', '/ledger-stats'], children: [
    { to: '/transactions', key: 'tx_pageTitle' },
    { to: '/recurring-money', key: 'sub_recurring' },
    { to: '/accounts', key: 'acc_pageTitle' },
    { to: '/ledger-stats', key: 'sub_stats' },
  ] },
  { to: '/calendar', key: 'nav_calendar', Icon: Calendar, color: 'var(--module-calendar)', match: ['/recurring-events', '/calendar-categories', '/calendar-stats'], children: [
    { to: '/calendar', key: 'cal_pageTitle' },
    { to: '/recurring-events', key: 'sub_recurring_events' },
    { to: '/calendar-stats', key: 'sub_stats' },
  ] },
  { to: '/community', key: 'nav_community', Icon: Users, color: 'var(--module-accounts)' },
  // 墨箋絮語:只放在網頁版左側選單;手機版從首頁卡片標題進入
  { to: '/notes', key: 'nav_notes', Icon: NotebookPen, color: 'var(--module-notes)', desktopOnly: true },
  { to: '/settings', key: 'nav_settings', Icon: Settings, color: 'var(--ink)' },
];

export function isTabActive(tab, pathname) {
  if (tab.end ? pathname === tab.to : pathname.startsWith(tab.to)) return true;
  return (tab.match || []).includes(pathname);
}
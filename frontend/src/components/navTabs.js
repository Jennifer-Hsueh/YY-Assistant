import { Home as HomeIcon, Wallet, Calendar, Users, Settings, NotebookPen, LibraryBig } from 'lucide-react';

export const navTabs = [
  { to: '/', key: 'nav_home', Icon: HomeIcon, color: 'var(--nav-active)', end: true },
  { to: '/transactions', key: 'nav_ledger', Icon: Wallet, color: 'var(--nav-active)', match: ['/recurring-money', '/accounts', '/categories', '/ledger-stats'], children: [
    { to: '/transactions', key: 'tx_pageTitle' },
    { to: '/recurring-money', key: 'sub_recurring' },
    { to: '/accounts', key: 'acc_pageTitle' },
    { to: '/ledger-stats', key: 'sub_stats' },
  ] },
  { to: '/calendar', key: 'nav_calendar', Icon: Calendar, color: 'var(--nav-active)', match: ['/recurring-events', '/calendar-categories', '/calendar-stats', '/anniversaries'], children: [
    { to: '/calendar', key: 'cal_pageTitle' },
    { to: '/recurring-events', key: 'sub_recurring_events' },
    { to: '/anniversaries', key: 'sub_anniversaries' },
    { to: '/calendar-stats', key: 'sub_stats' },
  ] },
  { to: '/community', key: 'nav_community', Icon: Users, color: 'var(--nav-active)', children: [
    { to: '/community/mood', key: 'cm_board_mood' },
    { to: '/community/finance', key: 'cm_board_finance' },
    { to: '/community/wish', key: 'cm_board_wish' },
    { to: '/community/mine', key: 'cm_mine' },
    { to: '/community/friends', key: 'cm_friends' },
  ] },
  // 墨箋絮語:只放在網頁版左側選單;手機版從首頁卡片標題進入
  { to: '/notes', key: 'nav_notes', Icon: NotebookPen, color: 'var(--nav-active)', desktopOnly: true },
  // 月刊書櫃:網頁版左側選單;手機版在頂部列的書櫃圖示
  { to: '/bookshelf', key: 'nav_bookshelf', Icon: LibraryBig, color: 'var(--nav-active)', desktopOnly: true },
  { to: '/settings', key: 'nav_settings', Icon: Settings, color: 'var(--nav-active)' },
];

export function isTabActive(tab, pathname) {
  if (tab.end ? pathname === tab.to : pathname.startsWith(tab.to)) return true;
  return (tab.match || []).includes(pathname);
}
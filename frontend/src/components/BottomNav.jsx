import { NavLink } from 'react-router-dom';
import { Home as HomeIcon, Wallet, Calendar, Users, Settings } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const tabs = [
  { to: '/', key: 'nav_home', Icon: HomeIcon, color: 'var(--ink)', end: true },
  { to: '/transactions', key: 'nav_ledger', Icon: Wallet, color: 'var(--module-transactions)' },
  { to: '/calendar', key: 'nav_calendar', Icon: Calendar, color: 'var(--module-calendar)' },
  { to: '/community', key: 'nav_community', Icon: Users, color: 'var(--module-accounts)' },
  { to: '/settings', key: 'nav_settings', Icon: Settings, color: 'var(--ink)' },
];

export default function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl justify-around">
        {tabs.map(({ to, key, Icon, color, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className="flex flex-col items-center gap-1 py-3 text-xs"
              style={({ isActive }) => ({
                color: isActive ? color : 'var(--muted-foreground)',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <Icon className="h-6 w-6" />
              {t(key)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

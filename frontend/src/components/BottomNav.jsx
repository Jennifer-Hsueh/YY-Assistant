import { NavLink } from 'react-router-dom';
import { Home, Wallet, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const tabs = [
  { to: '/', key: 'nav_home', Icon: Home, color: 'var(--ink)' },
  { to: '/transactions', key: 'nav_transactions', Icon: Wallet, color: 'var(--module-transactions)' },
  { to: '/calendar', key: 'nav_calendar', Icon: Calendar, color: 'var(--module-calendar)' },
  { to: '/accounts', key: 'nav_accounts', Icon: CreditCard, color: 'var(--module-accounts)' },
  { to: '/recurring', key: 'nav_recurring', Icon: RefreshCw, color: 'var(--module-recurring)' },
];

export default function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl justify-around">
        {tabs.map(({ to, key, Icon, color }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className="flex flex-col items-center gap-0.5 py-2 text-xs"
              style={({ isActive }) => ({
                color: isActive ? color : 'var(--muted-foreground)',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <Icon className="h-5 w-5" />
              {t(key)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

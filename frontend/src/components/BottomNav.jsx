import { NavLink } from 'react-router-dom';
import { Home, Wallet, Calendar, CreditCard, RefreshCw } from 'lucide-react';

const tabs = [
  { to: '/', label: '首頁', Icon: Home },
  { to: '/transactions', label: '記帳', Icon: Wallet },
  { to: '/calendar', label: '行事曆', Icon: Calendar },
  { to: '/accounts', label: '帳戶', Icon: CreditCard },
  { to: '/recurring', label: '循環', Icon: RefreshCw },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl justify-around">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className="flex flex-col items-center gap-0.5 py-2 text-xs"
              style={({ isActive }) => ({
                color: isActive ? 'var(--expense)' : 'var(--muted-foreground)',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

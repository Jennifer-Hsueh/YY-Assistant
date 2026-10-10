import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const subTabs = [
  { to: '/transactions', key: 'tx_pageTitle' },
  { to: '/recurring-money', key: 'sub_recurring' },
  { to: '/accounts', key: 'acc_pageTitle' },
  { to: '/ledger-stats', key: 'sub_stats' },
];

export default function LedgerSubNav() {
  const { t } = useLanguage();
  return (
    <div className="mb-3 flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm md:hidden">
      {subTabs.map(({ to, key }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 rounded-md px-2 py-1.5 text-center transition-colors ${isActive ? 'bg-muted font-medium' : 'text-muted-foreground'}`
          }
        >
          {t(key)}
        </NavLink>
      ))}
    </div>
  );
}

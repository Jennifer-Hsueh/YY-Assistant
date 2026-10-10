import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const subTabs = [
  { to: '/calendar', key: 'cal_pageTitle' },
  { to: '/recurring-events', key: 'sub_recurring_events' },
  { to: '/calendar-stats', key: 'sub_stats' },
];

export default function CalendarSubNav() {
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

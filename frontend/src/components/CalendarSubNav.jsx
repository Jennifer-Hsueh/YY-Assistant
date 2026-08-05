import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const subTabs = [
  { to: '/calendar', key: 'cal_pageTitle' },
  { to: '/recurring-events', key: 'sub_recurring_events' },
];

export default function CalendarSubNav() {
  const { t } = useLanguage();
  return (
    <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
      {subTabs.map(({ to, key }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 rounded-md px-2 py-1.5 text-center transition-colors ${isActive ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`
          }
        >
          {t(key)}
        </NavLink>
      ))}
    </div>
  );
}

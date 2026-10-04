import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { navTabs } from './navTabs';

export default function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-xl justify-around">
        {navTabs.map(({ to, key, Icon, color, end }) => (
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

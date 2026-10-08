import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { navTabs, isTabActive } from './navTabs';

export default function BottomNav() {
  const { t } = useLanguage();
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-xl justify-around">
        {navTabs.map((tab) => {
          const { to, key, Icon, color } = tab;
          const active = isTabActive(tab, pathname);
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className="flex flex-col items-center gap-1 py-3 text-xs"
                style={{
                  color: active ? color : 'var(--muted-foreground)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon className="h-6 w-6" />
                {t(key)}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { navTabs, isTabActive } from './navTabs';

export default function Sidebar() {
  const { logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { pathname } = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-card/95 backdrop-blur md:flex">
      <div className="flex items-end gap-3 px-5 py-5">
        <img src="/round-logo.png" alt={t('appName')} className="rounded-full" style={{ width: '72px', height: '72px', opacity: 0.4, marginBottom: '-12px' }} />
        <div className="flex items-end gap-1.5 leading-none">
          <span className="font-semibold" style={{ color: 'var(--ink)', fontSize: '20px', transform: 'translateY(-4px)', display: 'inline-block' }}>YY手帳</span>
          <span className="text-muted-foreground" style={{ fontSize: '12px', transform: 'translateY(-5px)', display: 'inline-block' }}>Assistant</span>
        </div>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navTabs.map((tab) => {
            const { to, key, Icon, color } = tab;
            const active = isTabActive(tab, pathname);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                  style={{
                    color: active ? color : 'var(--muted-foreground)',
                    fontWeight: active ? 500 : 400,
                    backgroundColor: active ? 'var(--muted)' : undefined,
                  }}
                >
                  <Icon className="h-5 w-5" />
                  {t(key)}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center gap-4 border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          <Languages className="h-3.5 w-3.5" />
          {language === 'zh' ? 'EN' : '中文'}
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
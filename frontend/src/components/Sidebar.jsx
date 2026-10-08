import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Languages, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { navTabs, isTabActive } from './navTabs';

export default function Sidebar() {
  const { logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const groupOf = (path) => navTabs.find((tb) => tb.children && isTabActive(tb, path))?.to || null;
  const [openGroup, setOpenGroup] = useState(() => groupOf(pathname));

  // Keep the group of the current page open; only one group is open at a time.
  useEffect(() => {
    setOpenGroup(groupOf(pathname));
  }, [pathname]);

  function toggleGroup(tab) {
    if (openGroup === tab.to) {
      setOpenGroup(null);
      return;
    }
    setOpenGroup(tab.to);
    navigate(tab.children[0].to);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-card/95 backdrop-blur md:flex">
      <div className="flex items-end gap-3 px-5 pt-5 pb-5">
        <img src="/round-logo.png" alt={t('appName')} className="rounded-full" style={{ width: '72px', height: '72px', opacity: 0.6, marginBottom: '-14px' }} />
        <div className="flex flex-col items-center gap-1 leading-none">
          <span className="font-semibold" style={{ color: 'var(--ink)', fontSize: '20px', display: 'inline-block' }}>YY手帳</span>
          <span className="text-muted-foreground" style={{ fontSize: '12px', display: 'inline-block' }}>Assistant</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {navTabs.map((tab) => {
            const { to, key, Icon, color, children } = tab;
            const active = isTabActive(tab, pathname);
            if (!children) {
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
            }
            const open = openGroup === to;
            return (
              <li key={to}>
                <button
                  type="button"
                  onClick={() => toggleGroup(tab)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                  style={{ color: active ? color : 'var(--muted-foreground)', fontWeight: active ? 500 : 400 }}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1 text-left">{t(key)}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <ul className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                    {children.map((c) => (
                      <li key={c.to}>
                        <NavLink
                          to={c.to}
                          end
                          className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                          style={({ isActive }) => ({
                            color: isActive ? color : 'var(--muted-foreground)',
                            fontWeight: isActive ? 500 : 400,
                            backgroundColor: isActive ? 'var(--muted)' : undefined,
                          })}
                        >
                          {t(c.key)}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
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
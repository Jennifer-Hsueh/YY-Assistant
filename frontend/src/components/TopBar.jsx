import { LogOut, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function TopBar() {
  const { logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
        <div className="flex items-end gap-4">
  <img src="/round-logo.png" alt={t('appName')} className="h-12 w-12 rounded-full" />
  <div className="flex items-end gap-1.5 leading-none">
  <span className="font-semibold" style={{ color: 'var(--ink)', fontSize: '20px', transform: 'translateY(-4px)', display: 'inline-block' }}>YY手帳</span>
  <span className="text-muted-foreground" style={{ fontSize: '12px', transform: 'translateY(-1px)', display: 'inline-block' }}>Assistant</span>
  </div>
</div>
        <div className="flex items-end gap-2">
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
      </div>
    </header>
  );
}

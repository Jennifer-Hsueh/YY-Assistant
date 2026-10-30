import { ROUND_SRCSET } from './BrandMark';
import { LogOut, Languages, LibraryBig } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AnnouncementBell from './AnnouncementBell';
import { BetaTag } from './BrandMark';
import { useBeta } from '../lib/useBeta';

export default function TopBar() {
  const { logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const beta = useBeta();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur md:hidden" style={{ paddingTop: 'var(--sat, 0px)' }}>
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 pt-2 pb-4">
        <div className="flex items-end gap-4">
          <img src="/round-logo-192.png" srcSet={ROUND_SRCSET} sizes="72px" alt={t('appName')} className="rounded-full" style={{ width: '72px', height: '72px', opacity: 0.6, marginBottom: '-14px' }} />
          <div className="flex flex-col items-center gap-1 leading-none">
            <span className="font-semibold" style={{ color: 'var(--ink)', fontSize: '20px', display: 'inline-block' }}>YY手帳</span>
            <span className="text-muted-foreground" style={{ fontSize: '12px', display: 'inline-block' }}>Assistant</span>
          </div>
          {beta?.active && <span className="mb-1"><BetaTag lang={language} /></span>}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/bookshelf" aria-label={t('nav_bookshelf')} className="flex items-center text-muted-foreground"><LibraryBig className="h-5 w-5" /></Link>
          <AnnouncementBell />
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

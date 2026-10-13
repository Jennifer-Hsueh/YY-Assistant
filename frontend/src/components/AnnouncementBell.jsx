import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAnnStatus, refreshAnnStatus } from '../lib/annStatus';

// 未讀紅點:最多顯示 9+
export function UnreadBadge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C1666B] px-1 text-[10px] font-semibold leading-none text-white ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

// 每次換頁重新抓一次未讀數(有快取合併,不會重複請求)
export function useAnnRefreshOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== '/announcements') refreshAnnStatus();
  }, [pathname]);
}

// 手機版頂部列用的鈴鐺
export default function AnnouncementBell() {
  const { t } = useLanguage();
  const { unread } = useAnnStatus();
  useAnnRefreshOnNavigate();
  return (
    <Link to="/announcements" aria-label={t('nav_announcements')} className="relative flex items-center text-muted-foreground">
      <Bell className="h-5 w-5" />
      <UnreadBadge count={unread} className="absolute -right-2 -top-1.5" />
    </Link>
  );
}

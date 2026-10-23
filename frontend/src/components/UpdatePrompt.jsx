import { useRegisterSW } from 'virtual:pwa-register/react';
import { X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CHECK_EVERY = 30 * 60 * 1000; // 每 30 分鐘檢查一次是否有新版本

// 網頁版:偵測到新版本時,在畫面上方提示「更新」
export default function UpdatePrompt() {
  const { language } = useLanguage();
  const en = language === 'en';
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine && !reg.installing) reg.update().catch(() => {}); };
      setInterval(check, CHECK_EVERY);
      // 從背景切回來時也檢查(手機上 App 常常一直開著)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });

  const update = () => {
    updateServiceWorker(true);
    // 新版已經接手時不會觸發自動重新整理,這裡補一次
    setTimeout(() => window.location.reload(), 1500);
  };

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 z-[70] flex justify-center px-4" style={{ top: 'calc(var(--sat, 0px) + 10px)' }}>
      <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card py-2 pl-4 pr-2 text-sm shadow-lg" style={{ color: 'var(--ink)' }}>
        <span>{en ? 'A new version is available' : '有新版本'}</span>
        <button type="button" onClick={update}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
          {en ? 'Update' : '更新'}
        </button>
        <button type="button" onClick={() => setNeedRefresh(false)} aria-label={en ? 'Close' : '關閉'} className="rounded-md p-1 text-muted-foreground hover:bg-black/5">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

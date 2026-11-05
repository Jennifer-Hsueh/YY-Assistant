import { useEffect } from 'react';

// 測試站標示:網址有 staging(或在本機開發)時,畫面上方顯示「測試站」,分頁標題前面也加上【測試站】
// 正式站不會顯示
export const isStaging = typeof window !== 'undefined' && /staging/i.test(window.location.hostname);

export default function StagingRibbon() {
  useEffect(() => {
    if (!isStaging) return undefined;
    const fix = () => { if (!document.title.startsWith('【測試站】')) document.title = `【測試站】${document.title}`; };
    fix();
    const obs = new MutationObserver(fix);
    const el = document.querySelector('title');
    if (el) obs.observe(el, { childList: true });
    return () => obs.disconnect();
  }, []);
  if (!isStaging) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-0 z-[80] -translate-x-1/2 rounded-b-lg px-3 py-0.5 text-xs font-semibold text-white shadow" style={{ background: '#E07A2E' }}>
      測試站 STAGING
    </div>
  );
}

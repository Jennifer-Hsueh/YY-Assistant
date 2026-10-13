import { useEffect, useState } from 'react';

export const DESKTOP_QUERY = '(min-width: 768px)';

// 桌機版(寬度 ≥ 768px,對應 Tailwind 的 md:)
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

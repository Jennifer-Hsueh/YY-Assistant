import { useEffect, useState } from 'react';

// 桌機版(寬度 ≥ 768px,對應 Tailwind 的 md:)
export function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

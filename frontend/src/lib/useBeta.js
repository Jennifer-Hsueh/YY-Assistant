import { useEffect, useState } from 'react';
import { api } from './api';

// 測試版狀態(名額、是否測試中、結束日);整個 App 共用一次讀取
let cached = null;
let pending = null;

export function useBeta() {
  const [beta, setBeta] = useState(cached);
  useEffect(() => {
    if (cached) return;
    pending = pending || api.getBeta().then(({ beta: b }) => { cached = b; return b; }).catch(() => null);
    let alive = true;
    pending.then((b) => { if (alive && b) setBeta(b); });
    return () => { alive = false; };
  }, []);
  return beta;
}

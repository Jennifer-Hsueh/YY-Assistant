import { useEffect, useState } from 'react';
import { api } from './api';

// 小紙條未讀數:首頁選單上的紅點(側邊選單與底部導覽共用,只抓一次)
let count = 0;
let inflight = null;
let last = 0;
const listeners = new Set();

function set(n) {
  count = n;
  listeners.forEach((fn) => fn(count));
}

export function refreshSlipStatus(force = false) {
  if (!force && Date.now() - last < 15000) return inflight;
  if (!inflight) {
    last = Date.now();
    inflight = api.slipUnread()
      .then(({ count: n }) => set(n || 0))
      .catch(() => {})
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export const setSlipUnread = (n) => set(n);

export function useSlipUnread() {
  const [n, setN] = useState(count);
  useEffect(() => {
    listeners.add(setN);
    const onFocus = () => refreshSlipStatus(true);
    window.addEventListener('focus', onFocus);
    return () => { listeners.delete(setN); window.removeEventListener('focus', onFocus); };
  }, []);
  return n;
}

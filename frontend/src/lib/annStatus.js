import { useEffect, useState } from 'react';
import { api } from './api';

// 公告未讀數與重要公告橫幅的共用狀態(鈴鐺在頂部列與側邊選單各一個,只抓一次)
let state = { unread: 0, banner: null };
let inflight = null;
const listeners = new Set();

function set(next) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
}

export function refreshAnnStatus() {
  if (!inflight) {
    inflight = api.getAnnouncementStatus()
      .then(({ unread, banner }) => set({ unread: unread || 0, banner: banner || null }))
      .catch(() => {}) // 欄位尚未建立或離線時,鈴鐺就不顯示紅點
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export async function markAnnouncementsSeen() {
  set({ unread: 0, banner: null });
  try { await api.markAnnouncementsSeen(); } catch (err) { console.error(err); }
}

export async function dismissAnnBanner() {
  set({ banner: null });
  try { await api.dismissAnnouncementBanner(); } catch (err) { console.error(err); }
}

export function useAnnStatus() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);
  return s;
}

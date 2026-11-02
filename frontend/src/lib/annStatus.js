import { useEffect, useState } from 'react';
import { api } from './api';

// 公告未讀數與重要公告橫幅的共用狀態(鈴鐺在頂部列與側邊選單各一個,只抓一次)
// unread:未讀公告;friendRequests:等我回覆的好友邀請;friendAccepted:接受了我邀請的人;total:鈴鐺上的數字
let state = { unread: 0, banner: null, friendRequests: 0, friendAccepted: 0, total: 0 };
let inflight = null;
const listeners = new Set();

function set(next) {
  state = { ...state, ...next };
  state.total = state.unread + state.friendRequests + state.friendAccepted;
  listeners.forEach((fn) => fn(state));
}

export function refreshAnnStatus() {
  if (!inflight) {
    inflight = api.getAnnouncementStatus()
      .then(({ unread, banner, friends }) => set({ unread: unread || 0, banner: banner || null, friendRequests: friends?.requests || 0, friendAccepted: friends?.accepted || 0 }))
      .catch(() => {}) // 欄位尚未建立或離線時,鈴鐺就不顯示紅點
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export async function markAnnouncementsSeen() {
  set({ unread: 0, banner: null });
  try { await api.markAnnouncementsSeen(); } catch (err) { console.error(err); }
}

// 看過好友頁:「接受了你的邀請」歸零(好友邀請要回覆後才會消失)
export async function markFriendsSeen() {
  set({ friendAccepted: 0 });
  try { await api.markFriendsSeen(); } catch (err) { console.error(err); }
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

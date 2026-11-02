import { useEffect, useState } from 'react';
import { api } from './api';

// 公告未讀數與重要公告橫幅的共用狀態(鈴鐺在頂部列與側邊選單各一個,只抓一次)
// unread:未讀公告;friendRequests:等我回覆的好友邀請;friendAccepted:接受了我邀請的人;total:鈴鐺上的數字
let state = { unread: 0, banner: null, friendRequests: 0, friendAccepted: 0, invitesCal: 0, invitesLedger: 0, total: 0 };
let inflight = null;
const listeners = new Set();

function set(next) {
  state = { ...state, ...next };
  state.total = state.unread + state.friendRequests + state.friendAccepted + state.invitesCal + state.invitesLedger;
  listeners.forEach((fn) => fn(state));
}

export function refreshAnnStatus() {
  if (!inflight) {
    inflight = api.getAnnouncementStatus()
      .then(({ unread, banner, friends, invites }) => set({ unread: unread || 0, banner: banner || null, friendRequests: friends?.requests || 0, friendAccepted: friends?.accepted || 0, invitesCal: invites?.calendar || 0, invitesLedger: invites?.ledger || 0 }))
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

// 選單上各項目的數字:首頁=未讀小紙條、記帳=帳本邀請、行事曆=行事曆/行程/紀念日邀請、社群=好友邀請
export function navBadge(to, s, slipUnread) {
  if (to === '/') return slipUnread;
  if (to === '/transactions') return s.invitesLedger;
  if (to === '/calendar') return s.invitesCal;
  if (to === '/community') return s.friendRequests;
  return 0;
}

// 不用重新整理也會更新:每 30 秒(畫面開著時)、切回這個畫面、收到推播時,重新抓公告/邀請/小紙條
let liveStarted = false;
export function startLiveNotices(refreshSlips) {
  if (liveStarted) return;
  liveStarted = true;
  const tick = () => {
    if (document.visibilityState !== 'visible') return;
    refreshAnnStatus();
    refreshSlips?.();
  };
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('yy:push', () => { refreshAnnStatus(); refreshSlips?.(); });
}

export function useAnnStatus() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);
  return s;
}

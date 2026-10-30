// 每月一本書的書櫃:書櫃圖(public/bookshelf/shelf-N.webp,1024×1024)
// 每一格的可放書範圍(以圖片像素計):x 起點、w 可用寬度(扣掉盆栽)、floor 層板上緣、h 格子高度
// 也可以直接指定 bh 書高、bw 書寬、cap 最多幾本(依畫好的書量出來的)
// 書本圖:public/bookshelf/book-N.webp(N 對應封面 1–3 的顏色),寬:高 約 0.435
// 規則:每一格只放 2–4 本書;河狸佔了格子三分之二以上的格子不放書(不列在 cells 裡)
export const BOOK_MIN = 2;
export const BOOK_MAX = 4;

export const BOOK_RATIO = 0.435;

export const SHELVES = [
  {
    // 樹屋(2026-10-30 換成使用者畫好書的版本,書已從圖上移除,由程式放上)
    id: 1,
    src: '/bookshelf/shelf-1.webp',
    cells: [
      { x: 359, w: 91, floor: 455, bh: 69 },
      { x: 581, w: 102, floor: 456, bh: 77 },
      { x: 353, w: 57, floor: 561, bh: 70, bw: 28, cap: 2 },
      { x: 581, w: 100, floor: 561, bh: 70 },
      { x: 435, w: 87, floor: 661, bh: 70 },
      { x: 581, w: 135, floor: 663, bh: 71 },
      { x: 359, w: 102, floor: 766, bh: 72 },
      { x: 581, w: 127, floor: 767, bh: 72 },
    ],
  },
  {
    id: 2,
    src: '/bookshelf/shelf-2.webp',
    cells: [
      { x: 398, w: 192, floor: 386, h: 110 },
      { x: 398, w: 380, floor: 546, h: 106 },
      { x: 572, w: 206, floor: 706, h: 104 },
      { x: 398, w: 206, floor: 862, h: 100 },
    ],
  },
  {
    id: 3,
    src: '/bookshelf/shelf-3.webp',
    cells: [
      { x: 532, w: 212, floor: 332, h: 110 },
      { x: 382, w: 366, floor: 462, h: 92 },
      { x: 546, w: 204, floor: 592, h: 92 },
      { x: 386, w: 210, floor: 712, h: 88 },
      { x: 500, w: 248, floor: 826, h: 82 },
      { x: 392, w: 232, floor: 922, h: 66 },
    ],
  },
];

// 每格最多幾本(不超過 BOOK_MAX,也不超過放得下的數量)
export function cellCapacity(cell, bookW, gap = 3) {
  if (cell.cap) return cell.cap;
  return Math.min(BOOK_MAX, Math.max(1, Math.floor((cell.w + gap) / (bookW + gap))));
}

// 把 n 本書依序排進書櫃,回傳每本書的位置(圖片像素);放不下的不回傳
// 書高:有 bh 用 bh,否則約格子高的 86%;書寬依書本圖比例
export function layoutBooks(shelf, n) {
  const out = [];
  let left = n;
  for (const cell of shelf.cells) {
    if (left <= 0) break;
    const h = cell.bh || Math.round(cell.h * 0.86);
    const w = cell.bw || Math.round(h * BOOK_RATIO);
    const gap = cell.cap ? 0 : 3;
    const take = Math.min(left, cellCapacity(cell, w, gap));
    for (let i = 0; i < take; i += 1) {
      out.push({ x: cell.x + i * (w + gap), y: cell.floor - h, w, h });
    }
    left -= take;
  }
  return out;
}

export const shelfCapacity = (shelf) => layoutBooks(shelf, 999).length;

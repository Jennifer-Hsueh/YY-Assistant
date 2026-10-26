// 每月一本書的書櫃:三種書櫃圖(public/bookshelf/shelf-N.webp,1024×1024)
// 每一格的可放書範圍(以圖片像素計):x 起點、w 可用寬度(扣掉盆栽)、floor 層板上緣、h 格子高度
// 規則:每一格只放 2–4 本書;河狸佔了格子三分之二以上的格子不放書(不列在 cells 裡)
export const BOOK_MIN = 2;
export const BOOK_MAX = 4;

export const SHELVES = [
  {
    id: 1,
    src: '/bookshelf/shelf-1.webp',
    cells: [
      { x: 352, w: 98, floor: 465, h: 82 },
      { x: 572, w: 112, floor: 465, h: 82 },
      // 左邊第二格:河狸佔滿,不放書
      { x: 572, w: 104, floor: 576, h: 82 },
      { x: 446, w: 80, floor: 688, h: 86 },
      { x: 572, w: 128, floor: 688, h: 86 },
      { x: 352, w: 116, floor: 790, h: 84 },
      { x: 578, w: 118, floor: 790, h: 84 },
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
export function cellCapacity(cell, bookW) {
  return Math.min(BOOK_MAX, Math.max(BOOK_MIN, Math.floor(cell.w / bookW)));
}

// 把 n 本書依序排進書櫃,回傳每本書的位置(圖片像素);放不下的不回傳
// 書的大小依格子高度:高約格子的 80%,寬依封面比例 1:1.41 的書背(約高的 28%)
export function layoutBooks(shelf, n) {
  const out = [];
  let left = n;
  for (const cell of shelf.cells) {
    if (left <= 0) break;
    const h = Math.round(cell.h * 0.8);
    const w = Math.round(h * 0.28);
    const take = Math.min(left, cellCapacity(cell, w + 4));
    for (let i = 0; i < take; i += 1) {
      out.push({ x: cell.x + i * (w + 4), y: cell.floor - h, w, h });
    }
    left -= take;
  }
  return out;
}

export const shelfCapacity = (shelf) => layoutBooks(shelf, 999).length;

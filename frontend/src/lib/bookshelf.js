// 月刊書櫃(2026-11-27 換成使用者畫的 6 個書櫃,public/bookshelf/shelf/1–6.webp)
// 不用挑:從最小的書櫃開始放,放滿了自動換下一個比較大的;6 號放滿後再用一個 6 號
// 書是直立的書背(public/bookshelf/spine,寬:高 = 177:2480,年鑑寬 2 倍)
// 每一格(圖片原尺寸的像素):x 起點、w 可用寬度(避開擺飾)、floor 層板上緣、h 格子高度、cap 這格最多幾個位置(年鑑佔 2 個)
// 書櫃大小:1 號 14 個位置(剛好一年 12 本＋年鑑)、2 號 20、3 號 28、4 號 36、5 號 44、6 號 56
export const SPINE_RATIO = 177 / 2480;
const GAP = 0.18; // 書與書的間隔(書背寬的比例)

export const SHELVES = [
  { id: 1, src: '/bookshelf/shelf/1.webp', W: 370, H: 355, cells: [
    { x: 106, w: 166, floor: 194, h: 66, cap: 7 }, { x: 106, w: 166, floor: 274, h: 60, cap: 7 },
  ] },
  { id: 2, src: '/bookshelf/shelf/2.webp', W: 410, H: 385, cells: [
    { x: 172, w: 146, floor: 206, h: 75, cap: 13 }, { x: 142, w: 110, floor: 323, h: 100, cap: 7 },
  ] },
  { id: 3, src: '/bookshelf/shelf/3.webp', W: 490, H: 400, cells: [
    { x: 115, w: 135, floor: 206, h: 95, cap: 5 }, { x: 272, w: 98, floor: 185, h: 60, cap: 5 },
    { x: 72, w: 180, floor: 295, h: 75, cap: 8 }, { x: 272, w: 68, floor: 296, h: 95, cap: 3 },
    { x: 176, w: 120, floor: 368, h: 55, cap: 7 },
  ] },
  { id: 4, src: '/bookshelf/shelf/4.webp', W: 455, H: 450, cells: [
    { x: 232, w: 42, floor: 174, h: 78, cap: 3 }, { x: 118, w: 90, floor: 262, h: 72, cap: 7 },
    { x: 292, w: 58, floor: 145, h: 55, cap: 6 }, { x: 292, w: 108, floor: 222, h: 70, cap: 9 },
    { x: 292, w: 48, floor: 300, h: 68, cap: 4 }, { x: 292, w: 38, floor: 385, h: 70, cap: 3 },
    { x: 208, w: 64, floor: 385, h: 110, cap: 4 },
  ] },
  { id: 5, src: '/bookshelf/shelf/5.webp', W: 450, H: 535, cells: [
    { x: 175, w: 99, floor: 178, h: 58, cap: 8 }, { x: 100, w: 174, floor: 252, h: 62, cap: 13 },
    { x: 102, w: 126, floor: 323, h: 58, cap: 10 }, { x: 266, w: 64, floor: 360, h: 85, cap: 3 },
    { x: 100, w: 44, floor: 402, h: 60, cap: 3 }, { x: 160, w: 92, floor: 402, h: 62, cap: 7 },
  ] },
  { id: 6, src: '/bookshelf/shelf/6.webp', W: 631, H: 575, cells: [
    { x: 180, w: 155, floor: 230, h: 65, cap: 7 }, { x: 352, w: 118, floor: 199, h: 45, cap: 8 },
    { x: 352, w: 158, floor: 266, h: 55, cap: 9 }, { x: 135, w: 113, floor: 312, h: 70, cap: 5 },
    { x: 262, w: 133, floor: 347, h: 95, cap: 4 }, { x: 410, w: 108, floor: 347, h: 68, cap: 5 },
    { x: 105, w: 93, floor: 412, h: 90, cap: 3 }, { x: 218, w: 137, floor: 430, h: 70, cap: 6 },
    { x: 105, w: 93, floor: 500, h: 75, cap: 4 }, { x: 218, w: 87, floor: 498, h: 55, cap: 5 },
  ] },
];

// 第 n 個書櫃(0 起)用哪一款:1→6,之後都是 6 號
export const shelfAt = (n) => SHELVES[Math.min(n, SHELVES.length - 1)];
export const shelfCapacity = (shelf) => shelf.cells.reduce((s, c) => s + c.cap, 0);

// 把書依序排進一個書櫃,回傳放得下的書的位置(圖片像素),依序對應 books
// books:每本是不是年鑑的陣列(true = 年鑑,佔 2 個位置、寬 2 倍);放不下就停(不跳過)
export function layoutBooks(shelf, books) {
  const out = [];
  let i = 0;
  for (const cell of shelf.cells) {
    const h = Math.round(cell.h * 0.92);
    const bw = h * SPINE_RATIO;
    let slots = 0;
    let x = cell.x;
    while (i < books.length) {
      const need = books[i] ? 2 : 1;
      const w = bw * need;
      if (slots + need > cell.cap || x + w > cell.x + cell.w) break;
      out.push({ x, y: cell.floor - h, w, h });
      x += w + bw * GAP;
      slots += need;
      i += 1;
    }
    if (i >= books.length) break;
  }
  return out;
}

// 所有書依序放進書櫃:第 1 個放滿才放第 2 個;回傳 [{ shelf, books: [...], spots }]
export function fillShelves(list, isYear) {
  const groups = [];
  let at = 0;
  do {
    const shelf = shelfAt(groups.length);
    const rest = list.slice(at);
    const spots = layoutBooks(shelf, rest.map(isYear));
    groups.push({ shelf, books: rest.slice(0, spots.length), spots, cap: shelfCapacity(shelf) });
    at += spots.length;
    if (!spots.length) break; // 保險:放不下任何一本時停止
  } while (at < list.length);
  return groups;
}

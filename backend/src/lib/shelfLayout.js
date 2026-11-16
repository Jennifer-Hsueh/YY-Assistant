// 書櫃排書規則(與前端 frontend/src/lib/bookshelf.js 相同,改一邊要一起改另一邊)
// 每格從左排到右:寬度放得下、而且不超過 4 本(或該格的 cap)才放;年鑑比較胖(寬 1.6 倍)
const BOOK_MAX = 4;
const BOOK_RATIO = 0.435;
const FAT = 1.6;
const CELLS = {
  1: [
    { x: 359, w: 91, floor: 455, bh: 69 }, { x: 581, w: 102, floor: 456, bh: 77 },
    { x: 353, w: 57, floor: 561, bh: 70, bw: 28, cap: 2 }, { x: 581, w: 100, floor: 561, bh: 70 },
    { x: 435, w: 87, floor: 661, bh: 70 }, { x: 581, w: 135, floor: 663, bh: 71 },
    { x: 359, w: 102, floor: 766, bh: 72 }, { x: 581, w: 127, floor: 767, bh: 72 },
  ],
  2: [{ x: 398, w: 192, floor: 386, h: 110 }, { x: 398, w: 380, floor: 546, h: 106 }, { x: 572, w: 206, floor: 706, h: 104 }, { x: 398, w: 206, floor: 862, h: 100 }],
  3: [
    { x: 532, w: 212, floor: 332, h: 110 }, { x: 382, w: 366, floor: 462, h: 92 }, { x: 546, w: 204, floor: 592, h: 92 },
    { x: 386, w: 210, floor: 712, h: 88 }, { x: 500, w: 248, floor: 826, h: 82 }, { x: 392, w: 232, floor: 922, h: 66 },
  ],
};

// fats:每本書是不是年鑑(依書櫃順序);回傳放得下的本數
function packCount(style, fats) {
  let i = 0;
  for (const cell of CELLS[style] || []) {
    const h = cell.bh || Math.round(cell.h * 0.86);
    const w = cell.bw || Math.round(h * BOOK_RATIO);
    const gap = cell.cap ? 0 : 3;
    const maxN = cell.cap || BOOK_MAX;
    let used = 0;
    let n = 0;
    while (i < fats.length && n < maxN) {
      const bw = fats[i] ? Math.round(w * FAT) : w;
      const need = used + (n ? gap : 0) + bw;
      if (n > 0 && need > cell.w) break;
      used = need; n += 1; i += 1;
    }
  }
  return i;
}

// 目前選過的書櫃都放滿了嗎(可以選下一個)
function shelvesFull(styles, fats) {
  let rest = fats;
  for (const s of styles) {
    const placed = packCount(s, rest);
    rest = rest.slice(placed);
  }
  if (rest.length) return true;
  // 剛好放完:最後一個書櫃再放一本一般的書放不下 → 滿了
  const last = styles[styles.length - 1];
  let before = fats;
  for (const s of styles.slice(0, -1)) before = before.slice(packCount(s, before));
  return packCount(last, [...before, false]) <= before.length;
}

module.exports = { CELLS, FAT, packCount, shelvesFull };

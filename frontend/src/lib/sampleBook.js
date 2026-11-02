// 介紹頁試玩區的範例月刊(假資料,不會連到後端)
const YM = '2026-10';
const d = (n) => `${YM}-${String(n).padStart(2, '0')}`;

const MOODS = {
  1: 'sunny', 2: 'sunny', 3: 'cloudy', 4: 'love', 5: 'sunny', 6: 'flower', 7: 'rainy', 8: 'cloudy', 9: 'sunny', 10: 'exclaim',
  11: 'love', 12: 'sunny', 13: 'question', 14: 'rainy', 15: 'sunny', 16: 'flower', 17: 'sunny', 18: 'love', 19: 'cloudy', 20: 'angry',
  21: 'sunny', 22: 'sunny', 23: 'flower', 24: 'love', 25: 'sunny', 26: 'rainy', 27: 'cloudy', 28: 'sunny', 29: 'flower', 30: 'love', 31: 'exclaim',
};

const TEXT = {
  zh: {
    top: [['餐飲', '#D9822B', 6420], ['交通', '#4C7A9E', 2350], ['生活', '#5B9A68', 1880], ['購物', '#B9575E', 1560], ['娛樂', '#8E6BB0', 980]],
    ledgers: [['日常', false, 48000, 11230], ['日本旅遊', true, 0, 1960]],
    events: [[3, '牙醫回診', '#5B9A68'], [6, '全家聚餐', '#D9822B'], [10, '和阿哲看電影', '#8E6BB0'], [13, '瑜珈課', '#B9575E'], [17, '繳信用卡', '#4C7A9E'], [20, '瑜珈課', '#B9575E'], [24, '登山', '#5B9A68'], [27, '瑜珈課', '#B9575E']],
    annivs: [[11, '交往紀念日'], [19, '媽媽生日']],
    notes: [[2, '買貓砂、補衛生紙'], [8, '預約週末餐廳'], [15, '寄生日卡給媽媽'], [22, '把旅遊照片整理成相簿'], [29, '下個月開始每週存 500 元']],
    posts: [[12, 'finance', null, '記帳第三個月的小心得', '把每天的手搖飲記下來才發現一個月花了快兩千，這個月開始一週只喝兩杯，省下來的錢存進旅遊基金。'], [24, 'mood', 'sunny', '', '爬完山在山頂吃飯糰，風很涼，覺得自己好幸福。']],
    message: '謝謝這個月認真生活的自己。',
  },
  en: {
    top: [['Dining', '#D9822B', 6420], ['Transport', '#4C7A9E', 2350], ['Living', '#5B9A68', 1880], ['Shopping', '#B9575E', 1560], ['Fun', '#8E6BB0', 980]],
    ledgers: [['Daily', false, 48000, 11230], ['Japan trip', true, 0, 1960]],
    events: [[3, 'Dentist', '#5B9A68'], [6, 'Family dinner', '#D9822B'], [10, 'Movie with Kai', '#8E6BB0'], [13, 'Yoga', '#B9575E'], [17, 'Pay card bill', '#4C7A9E'], [20, 'Yoga', '#B9575E'], [24, 'Hiking', '#5B9A68'], [27, 'Yoga', '#B9575E']],
    annivs: [[11, 'Our anniversary'], [19, "Mom's birthday"]],
    notes: [[2, 'Cat litter and tissues'], [8, 'Book a table for the weekend'], [15, 'Mail a birthday card to Mom'], [22, 'Make a photo album of the trip'], [29, 'Save NT$500 every week from next month']],
    posts: [[12, 'finance', null, 'Three months of budgeting', 'Logging every bubble tea showed me I spent almost NT$2,000 a month. Now it is two a week, and the savings go to the travel fund.'], [24, 'mood', 'sunny', '', 'Ate a rice ball at the summit. The breeze was cool and I felt so lucky.']],
    message: 'Thank you, me, for living this month with care.',
  },
};

export function sampleBook(lang = 'zh') {
  const tx = TEXT[lang] || TEXT.zh;
  const expense = tx.top.reduce((s, x) => s + x[2], 0);
  const data = {
    ym: YM,
    money: {
      currency: 'TWD', income: 48000, expense, others: [],
      top: tx.top.map(([name, color, amount]) => ({ name, color, amount })),
      ledgers: tx.ledgers.map(([name, shared, income, exp]) => ({ name, shared, income, expense: exp })),
      tx_count: 46,
    },
    events: tx.events.map(([n, title, color]) => ({ date: d(n), title, color })),
    annivs: tx.annivs.map(([n, title]) => ({ date: d(n), title, icon: null })),
    moods: Object.fromEntries(Object.entries(MOODS).map(([n, m]) => [d(n), m])),
    notes: tx.notes.map(([n, content]) => ({ date: d(n), content })),
    posts: tx.posts.map(([n, board, mood, title, content]) => ({ date: d(n), board, mood, title, content, images: [] })),
  };
  data.counts = { events: data.events.length, annivs: data.annivs.length, words: data.notes.length + data.posts.length, tx: 46 };
  return { ym: YM, cover: 2, message: tx.message, data };
}

// 本日心情(九種);首頁的心情選擇與小圓圖示共用
export const MOODS = [
  { key: 'question', emoji: '❓' },
  { key: 'angry', emoji: '😠' },
  { key: 'rainy', emoji: '🌧️' },
  { key: 'storm', emoji: '⛈️' },
  { key: 'love', emoji: '❤️' },
  { key: 'sunny', emoji: '☀️' },
  { key: 'cloudy', emoji: '☁️' },
  { key: 'exclaim', emoji: '❗' },
  { key: 'flower', emoji: '🌸' },
];

// 舊資料可能還有 rainbow,照樣顯示
const LEGACY = { rainbow: '🌈' };

export const moodEmoji = (key) => MOODS.find((m) => m.key === key)?.emoji || LEGACY[key] || null;

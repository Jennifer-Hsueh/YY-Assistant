// 本日心情(五種天氣);首頁角色旁的小圖示與設定頁的選擇共用
export const MOODS = [
  { key: 'sunny', emoji: '☀️' },
  { key: 'cloudy', emoji: '⛅' },
  { key: 'rainy', emoji: '🌧️' },
  { key: 'storm', emoji: '⛈️' },
  { key: 'rainbow', emoji: '🌈' },
];

export const moodEmoji = (key) => MOODS.find((m) => m.key === key)?.emoji || null;

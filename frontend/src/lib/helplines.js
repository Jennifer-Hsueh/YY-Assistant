// 各國安心專線(2026-10-15 查證);只列出確認有專線的國家
// 沒有設定國別的使用者一律顯示台灣
export const HELPLINES = {
  TW: { name: { zh: '台灣', en: 'Taiwan' }, line: { zh: '安心專線', en: 'Mental Health Hotline' }, number: '1925', h24: true },
  HK: { name: { zh: '香港', en: 'Hong Kong' }, line: { zh: '撒瑪利亞防止自殺會', en: 'Samaritan Befrienders HK' }, number: '2389 2222', h24: true },
  JP: { name: { zh: '日本', en: 'Japan' }, line: { zh: 'よりそいホットライン', en: 'Yorisoi Hotline' }, number: '0120-279-338', h24: true },
  SG: { name: { zh: '新加坡', en: 'Singapore' }, line: { zh: 'Samaritans of Singapore', en: 'Samaritans of Singapore' }, number: '1767', h24: true },
  MY: { name: { zh: '馬來西亞', en: 'Malaysia' }, line: { zh: 'Befrienders KL', en: 'Befrienders KL' }, number: '03-7627 2929', h24: true },
  CN: { name: { zh: '中國大陸', en: 'Mainland China' }, line: { zh: '心理援助熱線', en: 'Psychological Assistance Hotline' }, number: '12356', h24: false },
  US: { name: { zh: '美國', en: 'United States' }, line: { zh: '自殺與危機專線', en: 'Suicide & Crisis Lifeline' }, number: '988', h24: true },
  GB: { name: { zh: '英國', en: 'United Kingdom' }, line: { zh: 'Samaritans', en: 'Samaritans' }, number: '116 123', h24: true },
};

export const COUNTRY_CODES = Object.keys(HELPLINES);

export const countryName = (code, lang) => HELPLINES[code]?.name[lang === 'en' ? 'en' : 'zh'] || '';

// 回傳「國別・專線名稱 號碼(24 小時)」;國別不在清單內時回傳 null(整列不顯示)
export function helplineText(code, lang) {
  const h = HELPLINES[code || 'TW'];
  if (!h) return null;
  const l = lang === 'en' ? 'en' : 'zh';
  const hours = h.h24 ? (l === 'en' ? ' (24h)' : '(24 小時)') : '';
  return `${h.name[l]}・${h.line[l]} ${h.number}${hours}`;
}

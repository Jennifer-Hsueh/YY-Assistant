// 新增帳戶時「銀行名稱」的建議清單(台灣常見銀行、郵局、電子支付)。
// 不是限制:清單沒有的(含國外銀行)可以直接輸入;使用者自己用過的名稱也會排在最前面。
export const COMMON_BANKS = [
  '臺灣銀行', '土地銀行', '合作金庫', '第一銀行', '華南銀行', '彰化銀行', '兆豐銀行', '臺灣企銀',
  '國泰世華', '中國信託', '台北富邦', '玉山銀行', '台新銀行', '永豐銀行', '元大銀行', '凱基銀行',
  '遠東商銀', '新光銀行', '聯邦銀行', '上海商銀', '京城銀行', '安泰銀行', '王道銀行', '高雄銀行',
  '星展銀行', '渣打銀行', '匯豐銀行', '將來銀行', 'LINE Bank', '樂天國際銀行', '中華郵政',
  '街口支付', '全支付', '悠遊付', 'LINE Pay Money', '一卡通 iPASS MONEY',
];

// 自己用過的在前,其餘常見銀行在後(不重複)
export function bankSuggestions(accounts) {
  const mine = [...new Set(accounts.map((a) => (a.bank || '').trim()).filter(Boolean))];
  return [...mine, ...COMMON_BANKS.filter((b) => !mine.includes(b))];
}

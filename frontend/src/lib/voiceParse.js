// 一句話記帳:把「昨天午餐 120 用現金」拆成 金額、日期、收入／支出、分類、帳戶、備註
// 全部在手機上用規則判斷,不送到任何 AI 服務;判斷不出來的欄位留空,讓使用者在確認畫面自己選
// 支援中文(含國字數字:一百二、三千五、1.5萬)、English、日本語的常見說法

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ── 國字數字 → 數字 ──
const DIGIT = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNIT = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 };
export function cnToNumber(s) {
  if (!s) return NaN;
  let total = 0; // 萬以上
  let section = 0; // 萬以下
  let num = 0;
  let lastUnit = 1;
  let any = false;
  for (const ch of s) {
    if (ch in DIGIT) { num = DIGIT[ch]; any = true; lastUnit = 0; continue; }
    if (ch in UNIT) {
      section += (num || 1) * UNIT[ch]; any = true;
      lastUnit = UNIT[ch]; num = 0;
      continue;
    }
    if (ch === '萬' || ch === '万') {
      total += (section + num || 1) * 10000; any = true;
      section = 0; num = 0; lastUnit = 10000;
      continue;
    }
    return NaN;
  }
  if (!any) return NaN;
  // 「一百二」「三千五」「一萬二」:最後一個數字跟在單位後面,代表下一位(百二 = 120)
  if (num && lastUnit === 0 && s.length >= 2) {
    const prev = s[s.length - 2];
    const u = UNIT[prev] || (prev === '萬' || prev === '万' ? 10000 : 0);
    if (u >= 100) return total + section + num * (u / 10);
  }
  return total + section + num;
}

const CN_NUM = '[零〇一二兩两三四五六七八九十拾百佰千仟萬万]+';
const CUR = '(?:元|塊錢|塊|块|圓|円|ドル|dollars?|bucks?|NT\\$?|\\$)';

// 找金額:優先找「數字＋元/塊」,其次「$數字」,再其次句子裡最後一個數字(不在日期裡的)
function findAmount(text) {
  const tries = [
    new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(萬|万|千|k|K)?\\s*${CUR}`),
    new RegExp(`(?:NT\\$?|\\$|¥)\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(萬|万|千|k|K)?`),
    new RegExp(`(${CN_NUM})\\s*${CUR}`),
  ];
  for (const re of tries) {
    const m = text.match(re);
    if (m) {
      const v = toValue(m[1], m[2]);
      if (v > 0) return { value: v, raw: m[0] };
    }
  }
  // 沒有單位:取最後一個數字(阿拉伯或國字),但跳過日期、時間
  const all = [...text.matchAll(new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(萬|万|千|k|K)?|(${CN_NUM})`, 'g'))]
    .filter((m) => !/^[\s]*(月|日|號|号|點|点|時|:|\/|週|周|星期|年)/.test(text.slice(m.index + m[0].length)))
    .filter((m) => !/(星期|週|周|禮拜|礼拜)$/.test(text.slice(0, m.index)));
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const m = all[i];
    const v = m[3] ? cnToNumber(m[3]) : toValue(m[1], m[2]);
    if (v > 0) return { value: v, raw: m[0] };
  }
  return null;
}
function toValue(numStr, unit) {
  let v = /\d/.test(numStr) ? Number(numStr.replace(/,/g, '')) : cnToNumber(numStr);
  if (unit === '萬' || unit === '万') v *= 10000;
  if (unit === '千' || unit === 'k' || unit === 'K') v *= 1000;
  return Math.round(v * 100) / 100;
}

// ── 日期 ──
const WEEK = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const WEEK_EN = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
function findDate(text, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rel = [
    [/大前天/, -3], [/前天|おととい|一昨日/, -2], [/昨天|昨日|昨晚|昨夜|yesterday/i, -1], [/今天|今日|今晚|today|tonight/i, 0],
  ];
  for (const [re, n] of rel) {
    const m = text.match(re);
    if (m) return { date: ymd(addDays(today, n)), raw: m[0] };
  }
  // 上週五／上星期五／這週一／週三
  let m = text.match(/(上上|上|這|这|本)?(?:週|周|星期|禮拜|礼拜)([一二三四五六日天])/);
  if (m) {
    const target = WEEK[m[2]];
    const cur = today.getDay();
    const mondayIdx = (d) => (d + 6) % 7; // 週一為一週開始
    let diff = mondayIdx(target) - mondayIdx(cur);
    if (m[1] === '上') diff -= 7;
    else if (m[1] === '上上') diff -= 14;
    else if (!m[1] && diff > 0) diff -= 7; // 只說「週五」且還沒到:當作上週五
    return { date: ymd(addDays(today, diff)), raw: m[0] };
  }
  m = text.match(/last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (m) {
    const target = WEEK_EN[m[1].toLowerCase()];
    let diff = target - today.getDay();
    if (diff >= 0) diff -= 7;
    return { date: ymd(addDays(today, diff)), raw: m[0] };
  }
  // 3月22日／3月22號／3/22／22號
  m = text.match(new RegExp(`(\\d{1,2}|${CN_NUM})\\s*月\\s*(\\d{1,2}|${CN_NUM})\\s*(?:日|號|号)?`))
    || text.match(/(?<![\d.])(\d{1,2})\/(\d{1,2})(?![\d/])/);
  if (m) {
    const mo = /\d/.test(m[1]) ? Number(m[1]) : cnToNumber(m[1]);
    const d = /\d/.test(m[2]) ? Number(m[2]) : cnToNumber(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      let y = today.getFullYear();
      if (new Date(y, mo - 1, d) > today) y -= 1; // 說到還沒到的日期:當作去年
      return { date: ymd(new Date(y, mo - 1, d)), raw: m[0] };
    }
  }
  m = text.match(new RegExp(`(\\d{1,2}|${CN_NUM})\\s*(?:號|号)`));
  if (m) {
    const d = /\d/.test(m[1]) ? Number(m[1]) : cnToNumber(m[1]);
    if (d >= 1 && d <= 31) {
      let dt = new Date(today.getFullYear(), today.getMonth(), d);
      if (dt > today) dt = new Date(today.getFullYear(), today.getMonth() - 1, d);
      return { date: ymd(dt), raw: m[0] };
    }
  }
  return { date: ymd(today), raw: '' };
}

// ── 收入／支出 ──
const INCOME_WORDS = /薪水|薪資|月薪|收入|入帳|進帳|领|領到|領了|賺|赚|獎金|奖金|分紅|股利|利息|退款|退費|退税|退稅|收到|中獎|發票中|給我|还我|還我|salary|income|paid me|refund|bonus|earned|received|給料|ボーナス|収入|入金/i;
const EXPENSE_HINT = /買|花|付|繳|缴|請客|吃|喝|買了|spent|paid|bought|払/i;

// ── 分類關鍵字(對應預設分類;使用者自己的分類名稱會先比對) ──
const CATEGORY_WORDS = [
  [['餐飲', 'Food'], /早餐|午餐|中餐|晚餐|宵夜|點心|下午茶|咖啡|飲料|手搖|奶茶|便當|麵|飯|吃|喝|外送|餐廳|聚餐|火鍋|早午餐|breakfast|lunch|dinner|coffee|tea|meal|food|snack|朝ごはん|昼ごはん|晩ごはん|ランチ|コーヒー|ご飯/i],
  [['交通', 'Transport'], /捷運|公車|客運|計程車|小黃|uber|高鐵|台鐵|火車|機票|加油|油錢|停車|過路|etc|悠遊卡|一卡通|ubike|taxi|bus|train|metro|gas|parking|flight|電車|タクシー|バス|ガソリン/i],
  [['日用品', 'Daily needs'], /衛生紙|洗髮|沐浴|牙膏|洗衣|清潔|日用|全聯|家樂福|好市多|costco|超市|toiletries|groceries|日用品|スーパー/i],
  [['購物', 'Shopping'], /衣服|褲子|鞋|包包|網購|蝦皮|momo|淘寶|買衣|化妝|保養|shopping|clothes|shoes|服|靴|買い物/i],
  [['居家', 'Home'], /房租|租金|水費|電費|瓦斯|網路費|管理費|家具|rent|utilities|electric|water bill|家賃|電気代|水道/i],
  [['娛樂', 'Entertainment'], /電影|遊戲|唱歌|ktv|演唱會|門票|旅遊|旅行|訂閱|netflix|spotify|movie|game|concert|ticket|travel|映画|ゲーム|旅行/i],
  [['醫療', 'Medical'], /看醫生|看病|掛號|醫院|診所|藥|牙醫|健保|doctor|clinic|hospital|medicine|pharmacy|病院|薬/i],
  [['學習', 'Learning'], /書|課程|學費|補習|講義|文具|book|course|tuition|class|本|授業|学費/i],
  [['薪資', 'Salary'], /薪水|薪資|月薪|salary|給料/i],
  [['獎金', 'Bonus'], /獎金|奖金|年終|bonus|ボーナス/i],
  [['投資', 'Investment'], /股利|股息|利息|配息|投資|dividend|interest|investment|配当|利息/i],
];

// ── 帳戶 ──
const CASH_WORDS = /現金|付現|现金|cash|現金で/i;
const CARD_WORDS = /刷卡|信用卡|credit card|カード/i;

// 學過的對應:同一個詞上次記在哪個分類(只存在這台裝置)
const MEMORY_KEY = 'yy_voice_memory';
function readMemory() {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}'); } catch { return {}; }
}
export function rememberCategory(note, category) {
  if (!note || !category) return;
  try {
    const m = readMemory();
    m[note.trim().toLowerCase().slice(0, 20)] = category;
    const keys = Object.keys(m);
    if (keys.length > 200) delete m[keys[0]];
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}

// categories:[{name, type}];accounts:[{id, name, bank}]
export function parseSpoken(input, { categories = [], accounts = [], now = new Date() } = {}) {
  const text = String(input || '').trim();
  const out = { type: 'expense', amount: '', date: ymd(now), category: '', account_id: '', note: '' };
  if (!text) return out;
  let rest = text;

  const amt = findAmount(text);
  if (amt) { out.amount = String(amt.value); rest = rest.replace(amt.raw, ' '); }
  const dt = findDate(rest, now);
  out.date = dt.date;
  if (dt.raw) rest = rest.replace(dt.raw, ' ');

  // 帳戶:先比對自己的帳戶名稱、銀行名稱(長的先比),再看「現金」「刷卡」
  const accs = [...accounts].map((a) => ({ a, keys: [a.name, a.bank, a.bank && `${a.bank}${a.name}`, a.bank && a.bank.length >= 3 && a.bank.slice(0, 2)].filter(Boolean) }));
  // (銀行名稱只說前兩個字也算,例如「國泰」→ 國泰世華)
  let accHit = null;
  for (const { a, keys } of accs) {
    for (const k of keys.sort((x, y) => y.length - x.length)) {
      if (k && text.toLowerCase().includes(k.toLowerCase()) && (!accHit || k.length > accHit.k.length)) accHit = { a, k };
    }
  }
  if (!accHit && CASH_WORDS.test(text)) {
    const cash = accounts.find((a) => CASH_WORDS.test(a.name));
    if (cash) accHit = { a: cash, k: '' };
  }
  if (!accHit && CARD_WORDS.test(text)) {
    const card = accounts.find((a) => /卡|card/i.test(a.name));
    if (card) accHit = { a: card, k: '' };
  }
  if (accHit) {
    out.account_id = accHit.a.id;
    if (accHit.k) rest = rest.replace(new RegExp(accHit.k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }

  // 收入或支出
  if (INCOME_WORDS.test(text) && !(EXPENSE_HINT.test(text) && !/薪|salary|給料|獎金|bonus/i.test(text))) out.type = 'income';

  // 備註:拿掉金額、日期、帳戶與連接詞後剩下的字
  out.note = rest
    .replace(/(用|拿|從|从|以|by|with|paid with|using|で|を使って)\s*(現金|付現|刷卡|信用卡|cash|card|カード)?/gi, ' ')
    .replace(/(花了|花|買了|買|付了|付|繳了|繳|收到|領到|領了|匯到|匯入|存到|轉到|刷卡|信用卡|spent|paid|bought|for|on|元|塊錢|塊)/gi, ' ')
    .replace(/[，,。.!！?？、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);

  // 分類:記憶 → 自己的分類名稱出現在句子裡 → 關鍵字對應到存在的分類
  const usable = categories.filter((c) => c.type !== 'event' && (c.type === out.type || c.type === 'general'));
  const has = (name) => usable.find((c) => c.name === name);
  const mem = readMemory()[out.note.toLowerCase().slice(0, 20)];
  if (mem && has(mem)) out.category = mem;
  if (!out.category) {
    const hit = [...usable].sort((a, b) => b.name.length - a.name.length).find((c) => text.toLowerCase().includes(c.name.toLowerCase()));
    if (hit) out.category = hit.name;
  }
  if (!out.category) {
    for (const [names, re] of CATEGORY_WORDS) {
      if (re.test(text)) {
        const c = names.map(has).find(Boolean);
        if (c) { out.category = c.name; break; }
      }
    }
  }
  return out;
}

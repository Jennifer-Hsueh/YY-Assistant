// 新使用者預設分類與帳戶(註冊時自動建立,之後可自行修改或刪除)
const supabase = require('../config/supabase');

const CATEGORIES = {
  zh: [
    ['餐飲', 'expense', '#E07A5F'], ['交通', 'expense', '#3D7EA6'], ['購物', 'expense', '#C77DBA'],
    ['日用品', 'expense', '#81B29A'], ['居家', 'expense', '#B08968'], ['娛樂', 'expense', '#F2A541'],
    ['醫療', 'expense', '#E5989B'], ['學習', 'expense', '#6D8EC4'], ['其他', 'general', '#9CA3AF'],
    ['薪資', 'income', '#4CAF7A'], ['獎金', 'income', '#2A9D8F'], ['投資', 'income', '#5C7AEA'],
    ['工作', 'event', '#3D7EA6'], ['生活', 'event', '#81B29A'], ['約會', 'event', '#E5989B'],
  ],
  en: [
    ['Food', 'expense', '#E07A5F'], ['Transport', 'expense', '#3D7EA6'], ['Shopping', 'expense', '#C77DBA'],
    ['Daily needs', 'expense', '#81B29A'], ['Home', 'expense', '#B08968'], ['Entertainment', 'expense', '#F2A541'],
    ['Medical', 'expense', '#E5989B'], ['Learning', 'expense', '#6D8EC4'], ['Other', 'general', '#9CA3AF'],
    ['Salary', 'income', '#4CAF7A'], ['Bonus', 'income', '#2A9D8F'], ['Investment', 'income', '#5C7AEA'],
    ['Work', 'event', '#3D7EA6'], ['Life', 'event', '#81B29A'], ['Social', 'event', '#E5989B'],
  ],
};

const ACCOUNTS = {
  zh: [['現金', '#81B29A'], ['銀行', '#3D7EA6']],
  en: [['Cash', '#81B29A'], ['Bank', '#3D7EA6']],
};

// 依序給不同的建立時間,列表才會照這個順序顯示
const stamp = (base, i) => new Date(base + i).toISOString();

async function seedDefaults(userId, lang = 'zh') {
  const L = lang === 'en' ? 'en' : 'zh';
  const base = Date.now();
  const cats = CATEGORIES[L].map(([name, type, color], i) => ({ user_id: userId, name, type, color, created_at: stamp(base, i) }));
  const accs = ACCOUNTS[L].map(([name, color], i) => ({ user_id: userId, name, color, balance: 0, currency: 'TWD', created_at: stamp(base, i) }));
  const [c, a] = await Promise.all([
    supabase.from('yy_categories').insert(cats),
    supabase.from('yy_accounts').insert(accs),
  ]);
  if (c.error) console.error('[seedDefaults] categories', c.error.message);
  if (a.error) console.error('[seedDefaults] accounts', a.error.message);
}

module.exports = { seedDefaults, CATEGORIES, ACCOUNTS };

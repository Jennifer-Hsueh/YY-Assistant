// 創始會員:測試期間有實際使用的使用者,正式上線後送一年全功能(full 方案)
const supabase = require('../config/supabase');
const E = require('./entitlements');

const MIN_RECORDS = 3; // 自己建立至少 3 筆記帳、行程、記事、心情或社群文章
const CONTENT_TABLES = ['yy_transactions', 'yy_events', 'yy_notes', 'yy_moods', 'yy_posts'];
const FREE_MONTHS = 12;

async function fetchCol(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// 每位使用者自己建立的資料筆數
async function recordCounts() {
  const counts = new Map();
  for (const t of CONTENT_TABLES) {
    for (const r of await fetchCol(t, 'user_id')) counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
  }
  return counts;
}

// 標記符合資格的使用者(只會新增標記,不會取消;管理員不算)
async function markEligible() {
  const users = await fetchCol('yy_users', 'id, role, is_disabled, founding_member');
  const counts = await recordCounts();
  const ids = users
    .filter((u) => u.role !== 'admin' && !u.is_disabled && !u.founding_member && (counts.get(u.id) || 0) >= MIN_RECORDS)
    .map((u) => u.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('yy_users')
      .update({ founding_member: true, founding_marked_at: new Date().toISOString() })
      .in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }
  return { marked: ids.length };
}

async function stats() {
  const users = await fetchCol('yy_users', 'id, founding_member, founding_granted_at');
  const f = users.filter((u) => u.founding_member);
  return { total: f.length, granted: f.filter((u) => u.founding_granted_at).length };
}

// 發放一年全功能:已有付費期間的接在後面延長;每人只發一次
async function grantAll(adminId, onGranted = () => {}) {
  const today = E.taipeiDate();
  const { data: users, error } = await supabase.from('yy_users')
    .select('id, email, plan_expires_at, is_disabled, founding_member, founding_granted_at')
    .eq('founding_member', true);
  if (error) throw error;
  const targets = (users || []).filter((u) => !u.founding_granted_at && !u.is_disabled);
  for (const u of targets) {
    const cur = u.plan_expires_at;
    const start = cur && E.addDays(cur, E.GRACE_DAYS) >= today ? cur : today;
    const end = E.addMonths(start, FREE_MONTHS);
    const { error: pErr } = await supabase.from('yy_payments').insert({
      user_id: u.id, user_email: u.email, paid_at: today, plan: 'full', addon_community: false,
      months: FREE_MONTHS, amount: 0, period_start: start, period_end: end, note: '創始會員一年免費', created_by: adminId,
    });
    if (pErr) throw pErr;
    const { error: uErr } = await supabase.from('yy_users')
      .update({ plan: 'full', addon_community: false, plan_expires_at: end, founding_granted_at: today })
      .eq('id', u.id);
    if (uErr) throw uErr;
    await supabase.from('yy_announcements').insert({
      title: '🦫 創始會員一年全功能已開通',
      content: `謝謝你在測試期間陪海狸一起長大！\n你的創始會員福利已開通：全功能方案可使用到 ${end.replace(/-/g, '/')}。`,
      is_important: true,
      target_user_id: u.id,
      published_at: new Date().toISOString(),
    });
    onGranted(u.id);
  }
  return { granted: targets.length };
}

module.exports = { MIN_RECORDS, CONTENT_TABLES, FREE_MONTHS, markEligible, stats, grantAll };

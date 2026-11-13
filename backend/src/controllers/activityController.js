// 【暫時功能】後台「使用狀況」:看誰有持續輸入資料(測試期間用,之後會拿掉)
// 拿掉時刪除:這個檔案、adminRoutes.js 的 /activity 那一行、admin/src/pages/Activity.jsx、
// admin/src/App.jsx 的 activity 選單、admin/src/api.js 的 activity
const supabase = require('../config/supabase');

async function fetchCol(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
const taipeiDay = (ts) => new Date(new Date(ts).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

// 算「輸入筆數」的資料(預設分類、帳戶不算)
const ENTRY_TABLES = [
  ['yy_transactions', 'user_id'], ['yy_events', 'user_id'], ['yy_notes', 'user_id'],
  ['yy_posts', 'user_id'], ['yy_moments', 'user_id'], ['yy_slips', 'sender_id'],
];

async function activity(req, res) {
  try {
    const users = (await fetchCol('yy_users', 'id, email, username, role, created_at, last_active_at, founding_member, founding_marked_at, is_disabled'))
      .filter((u) => u.role !== 'admin');
    const stat = new Map(users.map((u) => [u.id, { total: 0, last7: 0, entryDays: new Set(), allDays: new Set(), lastEntry: null }]));
    const since7 = Date.now() - 7 * 24 * 3600 * 1000;
    for (const [table, col] of ENTRY_TABLES) {
      for (const r of await fetchCol(table, `${col}, created_at`)) {
        const s = stat.get(r[col]);
        if (!s || !r.created_at) continue;
        const day = taipeiDay(r.created_at);
        s.total += 1;
        if (new Date(r.created_at).getTime() >= since7) s.last7 += 1;
        s.entryDays.add(day); s.allDays.add(day);
        if (!s.lastEntry || day > s.lastEntry) s.lastEntry = day;
      }
    }
    for (const r of await fetchCol('yy_moods', 'user_id, date')) {
      const s = stat.get(r.user_id); if (s) { s.entryDays.add(r.date); s.allDays.add(r.date); }
    }
    for (const r of await fetchCol('yy_active_days', 'user_id, day')) {
      const s = stat.get(r.user_id); if (s) s.allDays.add(r.day);
    }
    const rows = users.map((u) => {
      const s = stat.get(u.id);
      return {
        id: u.id, email: u.email, username: u.username, is_disabled: !!u.is_disabled,
        created: u.created_at ? taipeiDay(u.created_at) : null,
        last_active: u.last_active_at ? taipeiDay(u.last_active_at) : null,
        founding_member: !!u.founding_member,
        founding_removed: !u.founding_member && !!u.founding_marked_at,
        is_tester: u.role === 'tester',
        total: s.total, last7: s.last7, entry_days: s.entryDays.size, use_days: s.allDays.size, last_entry: s.lastEntry,
      };
    }).sort((a, b) => b.last7 - a.last7 || b.total - a.total);
    return res.json({ users: rows });
  } catch (err) {
    console.error('[activityController.activity]', err);
    return res.status(500).json({ error: '讀取使用狀況失敗' });
  }
}

module.exports = { activity };

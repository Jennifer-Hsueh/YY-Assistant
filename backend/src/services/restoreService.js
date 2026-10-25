const zlib = require('zlib');
const supabase = require('../config/supabase');
const { buildSnapshot, ensureBucket, TABLES, BUCKET } = require('./backupService');

// 從每週備份還原(管理後台使用)
// - 全站還原:先自動把「目前的資料」存成還原前備份,再清空所有資料表、依序寫回備份內容
// - 單一使用者還原:只換掉那位使用者的記帳、行事曆、記事、心情與社群資料
const FOLDERS = ['weekly', 'pre-restore', 'beta-end'];
const PRE_KEEP = 5;
const CHUNK = 500;
// 刪除全部資料時要用一個一定有值的欄位當條件
const KEY_COL = { yy_moods: 'user_id', yy_post_reactions: 'post_id', yy_user_blocks: 'blocker_id', yy_active_days: 'user_id', yy_ledger_members: 'ledger_id' };
// 單一使用者還原會處理的表(帳號本身、繳費、通知紀錄、故障通報、公告不動)
const USER_TABLES = [
  'yy_ledgers', 'yy_accounts', 'yy_categories', 'yy_transactions', 'yy_recurring_items', 'yy_events',
  'yy_budgets', 'yy_moods', 'yy_notes', 'yy_posts', 'yy_post_comments', 'yy_post_reactions', 'yy_post_reports',
];
const POST_CHILDREN = ['yy_post_comments', 'yy_post_reactions', 'yy_post_reports'];

const validPath = (p) => typeof p === 'string' && /^(weekly|pre-restore|beta-end)\/[A-Za-z0-9._-]+\.json\.gz$/.test(p);

async function listBackups() {
  const out = [];
  for (const folder of FOLDERS) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 100 });
    if (error || !data) continue;
    for (const f of data) {
      if (!f.name.endsWith('.json.gz')) continue;
      out.push({ path: `${folder}/${f.name}`, folder, name: f.name, size: f.metadata?.size ?? null, created_at: f.created_at || null });
    }
  }
  return out.sort((a, b) => (b.created_at || b.name).localeCompare(a.created_at || a.name));
}

async function downloadRaw(path) {
  if (!validPath(path)) throw Object.assign(new Error('備份檔名稱不正確'), { status: 400 });
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw Object.assign(new Error('找不到這份備份'), { status: 404 });
  return Buffer.from(await data.arrayBuffer());
}

async function readBackup(path) {
  const raw = await downloadRaw(path);
  const json = JSON.parse(zlib.gunzipSync(raw).toString());
  if (!json?.tables?.yy_users) throw Object.assign(new Error('不是 YY手帳 的備份檔'), { status: 400 });
  return json;
}

function summarize(backup) {
  const users = backup.tables.yy_users.map((u) => ({ id: u.id, email: u.email, username: u.username || null }));
  return { created_at: backup.created_at, kind: backup.kind, counts: backup.counts, users };
}

function userCounts(backup, userId) {
  const t = backup.tables;
  const postIds = new Set((t.yy_posts || []).filter((p) => p.user_id === userId).map((p) => p.id));
  const counts = {};
  for (const name of USER_TABLES) {
    counts[name] = (t[name] || []).filter((r) => r.user_id === userId || (POST_CHILDREN.includes(name) && postIds.has(r.post_id))).length;
  }
  return counts;
}

async function insertRows(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// 還原前先把目前資料存一份(放在 pre-restore/,保留最近 PRE_KEEP 份)
async function savePreRestore() {
  await ensureBucket();
  const snap = await buildSnapshot('pre-restore');
  const ts = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  const path = `pre-restore/yy-before-restore-${ts}.json.gz`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, zlib.gzipSync(Buffer.from(JSON.stringify(snap))), { contentType: 'application/gzip', upsert: true });
  if (error) throw error;
  const { data } = await supabase.storage.from(BUCKET).list('pre-restore', { limit: 100 });
  const names = (data || []).map((f) => f.name).filter((n) => n.endsWith('.json.gz')).sort();
  const old = names.slice(0, Math.max(0, names.length - PRE_KEEP)).map((n) => `pre-restore/${n}`);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
  return path;
}

async function restoreAll(backup) {
  const safety = await savePreRestore();
  const tables = TABLES.filter((t) => Array.isArray(backup.tables[t]));
  try {
    // 先刪(被參照的表最後刪),再依序寫回
    for (const t of [...tables].reverse()) {
      const col = KEY_COL[t] || 'id';
      const { error } = await supabase.from(t).delete().not(col, 'is', null);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    const counts = {};
    for (const t of tables) {
      await insertRows(t, backup.tables[t]);
      counts[t] = backup.tables[t].length;
    }
    return { safety, counts };
  } catch (err) {
    err.safety = safety;
    throw err;
  }
}

async function existingIds(table, ids) {
  const found = new Set();
  const list = [...ids];
  for (let i = 0; i < list.length; i += CHUNK) {
    const { data, error } = await supabase.from(table).select('id').in('id', list.slice(i, i + CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
    data.forEach((r) => found.add(r.id));
  }
  return found;
}

async function restoreUser(backup, userId) {
  const t = backup.tables;
  const userRow = (t.yy_users || []).find((u) => u.id === userId);
  if (!userRow) throw Object.assign(new Error('這份備份裡沒有這位使用者'), { status: 404 });
  const safety = await savePreRestore();
  try {
    // 帳號已被刪除時,用備份裡的帳號資料重建;帳號還在就保留目前的帳號設定(方案、密碼等)
    const { data: cur, error: curErr } = await supabase.from('yy_users').select('id').eq('id', userId).maybeSingle();
    if (curErr) throw curErr;
    if (!cur) await insertRows('yy_users', [userRow]);

    // 刪掉目前這位使用者的資料(文章刪除時,別人在上面的留言、回應也會一起刪,稍後從備份補回)
    for (const name of [...USER_TABLES].reverse()) {
      const { error } = await supabase.from(name).delete().eq('user_id', userId);
      if (error) throw new Error(`${name}: ${error.message}`);
    }

    const postIds = new Set((t.yy_posts || []).filter((p) => p.user_id === userId).map((p) => p.id));
    const rowsFor = (name) => (t[name] || []).filter((r) => r.user_id === userId || (POST_CHILDREN.includes(name) && postIds.has(r.post_id)));

    // 別人的帳號、文章可能已經不在:只寫回還存在的
    const otherUsers = new Set();
    const otherPosts = new Set();
    for (const name of POST_CHILDREN) {
      rowsFor(name).forEach((r) => {
        if (r.user_id !== userId) otherUsers.add(r.user_id);
        if (!postIds.has(r.post_id)) otherPosts.add(r.post_id);
      });
    }
    const liveUsers = await existingIds('yy_users', otherUsers);
    const livePosts = await existingIds('yy_posts', otherPosts);

    const counts = {};
    for (const name of USER_TABLES) {
      let rows = rowsFor(name);
      if (POST_CHILDREN.includes(name)) {
        rows = rows.filter((r) => (r.user_id === userId || liveUsers.has(r.user_id)) && (postIds.has(r.post_id) || livePosts.has(r.post_id)));
        // 別人的留言等可能沒被刪(例如他們在使用者「別的」文章上):先移除同 id / 同鍵再寫入
        if (name === 'yy_post_reactions') {
          for (const r of rows) await supabase.from(name).delete().eq('post_id', r.post_id).eq('user_id', r.user_id);
        } else if (rows.length) {
          const ids = rows.map((r) => r.id);
          for (let i = 0; i < ids.length; i += CHUNK) await supabase.from(name).delete().in('id', ids.slice(i, i + CHUNK));
        }
      }
      await insertRows(name, rows);
      counts[name] = rows.length;
    }
    return { safety, counts, recreated: !cur };
  } catch (err) {
    err.safety = safety;
    throw err;
  }
}

module.exports = { USER_TABLES, listBackups, readBackup, downloadRaw, summarize, userCounts, restoreAll, restoreUser, validPath };

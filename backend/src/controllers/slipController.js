// 小紙條:傳一句話(最多 25 字)給好友,或共同帳本/共同行程/共同紀念日的成員
// 收件人自己撕掉(刪除)之前一直保留;寄件人在對方還沒看之前可以收回
const supabase = require('../config/supabase');
const F = require('../lib/friends');
const { sendPushToUser } = require('../services/fcmService');

const MAX_LEN = 25;
const DAILY_MAX = 20; // 每人每天最多傳幾張
const CHUNK = 300;

function fail(res, where, err, msg) {
  console.error(`[slipController.${where}]`, err);
  return res.status(500).json({ error: msg });
}

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
const charLen = (s) => [...s].length;

// 某張「共同」表裡,和我在同一個項目的人(建立者+已加入的成員)
async function coMembers(userId, { table, memberTable, fk, ownerFilter }) {
  const ids = new Set();
  // 我參加的
  const { data: mine, error: e1 } = await supabase.from(memberTable).select(fk).eq('user_id', userId).eq('status', 'active');
  if (e1) throw e1;
  const joined = [...new Set((mine || []).map((r) => r[fk]))];
  // 我建立的
  let q = supabase.from(table).select('id').eq('user_id', userId);
  if (ownerFilter) q = ownerFilter(q);
  const { data: own, error: e2 } = await q;
  if (e2) throw e2;
  const all = [...new Set([...joined, ...(own || []).map((r) => r.id)])];
  for (let i = 0; i < all.length; i += CHUNK) {
    const part = all.slice(i, i + CHUNK);
    const { data: ms, error } = await supabase.from(memberTable).select('user_id').in(fk, part).eq('status', 'active');
    if (error) throw error;
    (ms || []).forEach((m) => ids.add(m.user_id));
  }
  if (joined.length) {
    for (let i = 0; i < joined.length; i += CHUNK) {
      const { data: owners, error } = await supabase.from(table).select('user_id').in('id', joined.slice(i, i + CHUNK));
      if (error) throw error;
      (owners || []).forEach((o) => o.user_id && ids.add(o.user_id));
    }
  }
  return ids;
}

// 可以傳小紙條的人:好友+共同帳本、共同行程、共同紀念日的成員(扣掉自己、封鎖、停用的帳號)
async function contactIds(userId) {
  const ids = new Set(await F.friendIds(userId));
  const groups = await Promise.all([
    coMembers(userId, { table: 'yy_ledgers', memberTable: 'yy_ledger_members', fk: 'ledger_id', ownerFilter: (q) => q.is('archived_at', null) }),
    coMembers(userId, { table: 'yy_events', memberTable: 'yy_event_members', fk: 'event_id' }),
    coMembers(userId, { table: 'yy_anniversaries', memberTable: 'yy_anniversary_members', fk: 'anniversary_id' }),
  ]);
  groups.forEach((g) => g.forEach((id) => ids.add(id)));
  ids.delete(userId);
  if (!ids.size) return [];
  const { data: blocks, error } = await supabase.from('yy_user_blocks').select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) throw error;
  (blocks || []).forEach((b) => { ids.delete(b.blocker_id); ids.delete(b.blocked_id); });
  return [...ids];
}

async function usersByIds(ids) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.from('yy_users').select('id, username, is_disabled').in('id', ids.slice(i, i + CHUNK));
    if (error) throw error;
    (data || []).forEach((u) => map.set(u.id, u));
  }
  return map;
}

// GET /slips/contacts
async function contacts(req, res) {
  try {
    const ids = await contactIds(req.user.id);
    const users = await usersByIds(ids);
    const list = ids.map((id) => users.get(id)).filter((u) => u && !u.is_disabled)
      .map((u) => ({ id: u.id, name: u.username || null }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
    return res.json({ contacts: list });
  } catch (err) {
    return fail(res, 'contacts', err, '讀取名單失敗');
  }
}

// GET /slips:收到的(全部)、送出的(自己沒移除的)
async function list(req, res) {
  try {
    const uid = req.user.id;
    let [{ data: received, error: e1 }, { data: sent, error: e2 }] = await Promise.all([
      supabase.from('yy_slips').select('*').eq('recipient_id', uid).order('created_at', { ascending: false }),
      supabase.from('yy_slips').select('*').eq('sender_id', uid).eq('sender_hidden', false).order('created_at', { ascending: false }).limit(100),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    // 我封鎖的人傳來的紙條不顯示
    const { data: blocks, error: e3 } = await supabase.from('yy_user_blocks').select('blocked_id').eq('blocker_id', uid);
    if (e3) throw e3;
    const blocked = new Set((blocks || []).map((b) => b.blocked_id));
    received = (received || []).filter((s) => !blocked.has(s.sender_id));
    const users = await usersByIds([...new Set([...(received || []).map((s) => s.sender_id), ...(sent || []).map((s) => s.recipient_id)].filter(Boolean))]);
    const nameOf = (id) => (id ? users.get(id)?.username || null : null);
    return res.json({
      received: (received || []).map((s) => ({ id: s.id, content: s.content, created_at: s.created_at, read_at: s.read_at, from: s.sender_id ? { id: s.sender_id, name: nameOf(s.sender_id) } : null })),
      sent: (sent || []).map((s) => ({ id: s.id, content: s.content, created_at: s.created_at, read_at: s.read_at, to: { id: s.recipient_id, name: nameOf(s.recipient_id) } })),
    });
  } catch (err) {
    return fail(res, 'list', err, '讀取小紙條失敗');
  }
}

// POST /slips { to, content }
async function send(req, res) {
  try {
    const uid = req.user.id;
    const to = String(req.body?.to || '');
    const content = clean(req.body?.content);
    if (!content) return res.status(400).json({ error: '請寫點什麼' });
    if (charLen(content) > MAX_LEN) return res.status(400).json({ error: '小紙條最多 25 個字' });
    const ids = await contactIds(uid);
    if (!ids.includes(to)) return res.status(400).json({ error: '只能傳給好友或共同成員' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: cErr } = await supabase.from('yy_slips').select('id', { count: 'exact', head: true }).eq('sender_id', uid).gte('created_at', since);
    if (cErr) throw cErr;
    if ((count || 0) >= DAILY_MAX) return res.status(429).json({ error: '今天傳太多張了，明天再傳吧' });
    const { data, error } = await supabase.from('yy_slips').insert({ sender_id: uid, recipient_id: to, content, sender_hidden: false }).select('*').single();
    if (error) throw error;
    const { data: me } = await supabase.from('yy_users').select('username').eq('id', uid).maybeSingle();
    sendPushToUser(to, { title: '📝 小紙條', body: `${me?.username || 'YY手帳使用者'} 傳了一張小紙條給你`, data: { url: '/' } }).catch(() => {});
    return res.status(201).json({ slip: { id: data.id, content: data.content, created_at: data.created_at, read_at: null } });
  } catch (err) {
    return fail(res, 'send', err, '傳送失敗');
  }
}

// GET /slips/unread:未讀數(選單上的紅點)
async function unread(req, res) {
  try {
    const [{ data: rows, error }, { data: blocks, error: bErr }] = await Promise.all([
      supabase.from('yy_slips').select('sender_id').eq('recipient_id', req.user.id).is('read_at', null),
      supabase.from('yy_user_blocks').select('blocked_id').eq('blocker_id', req.user.id),
    ]);
    if (error) throw error;
    if (bErr) throw bErr;
    const blocked = new Set((blocks || []).map((b) => b.blocked_id));
    return res.json({ count: (rows || []).filter((r) => !blocked.has(r.sender_id)).length });
  } catch (err) {
    return fail(res, 'unread', err, '讀取小紙條失敗');
  }
}

// POST /slips/read { ids }:收件人看過了
async function markRead(req, res) {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).slice(0, 200);
    if (ids.length) {
      const { error } = await supabase.from('yy_slips').update({ read_at: new Date().toISOString() })
        .eq('recipient_id', req.user.id).is('read_at', null).in('id', ids);
      if (error) throw error;
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'markRead', err, '更新失敗');
  }
}

// DELETE /slips/:id:收件人撕掉;寄件人在對方還沒看之前收回,看過了就只從自己的「送出」移除
async function remove(req, res) {
  try {
    const uid = req.user.id;
    const { data: slip, error } = await supabase.from('yy_slips').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!slip || (slip.recipient_id !== uid && slip.sender_id !== uid)) return res.status(404).json({ error: '找不到這張小紙條' });
    if (slip.recipient_id === uid || !slip.read_at) {
      const { error: dErr } = await supabase.from('yy_slips').delete().eq('id', slip.id);
      if (dErr) throw dErr;
      return res.json({ ok: true, removed: slip.recipient_id === uid ? 'torn' : 'recalled' });
    }
    const { error: uErr } = await supabase.from('yy_slips').update({ sender_hidden: true }).eq('id', slip.id);
    if (uErr) throw uErr;
    return res.json({ ok: true, removed: 'hidden' });
  } catch (err) {
    return fail(res, 'remove', err, '刪除失敗');
  }
}

module.exports = { contacts, list, unread, send, markRead, remove, contactIds, MAX_LEN, DAILY_MAX };

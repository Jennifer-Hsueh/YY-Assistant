const supabase = require('../config/supabase');
const F = require('../lib/friends');
const { sendPushToUser } = require('../services/fcmService');

const MAX_FRIENDS = 200;
const MAX_PENDING_OUT = 50;
const REPORT_MAX = 300;

function fail(res, where, err, msg) {
  console.error(`[friendController.${where}]`, err);
  return res.status(500).json({ error: msg });
}

// 對外顯示的名字:只用稱呼,不露出 Email
const pub = (u) => ({ id: u.id, name: u.username || null });

async function usersByIds(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('yy_users').select('id, username, is_disabled').in('id', ids);
  if (error) throw error;
  return new Map((data || []).filter((u) => !u.is_disabled).map((u) => [u.id, u]));
}

// 取得(沒有就建立)自己的好友碼
async function ensureCode(userId) {
  const { data: me, error } = await supabase.from('yy_users').select('id, username, friend_code').eq('id', userId).single();
  if (error) throw error;
  if (me.friend_code) return me;
  return setNewCode(me);
}
async function setNewCode(me) {
  for (let i = 0; i < 5; i++) {
    const code = F.randomCode();
    const { data, error } = await supabase.from('yy_users').update({ friend_code: code }).eq('id', me.id).select('id, username, friend_code').single();
    if (!error) return data;
    if (error.code !== '23505') throw error; // 撞號就再產生一次
  }
  throw new Error('failed to generate friend code');
}

async function overview(req, res) {
  try {
    const uid = req.user.id;
    const me = await ensureCode(uid);
    const [{ data: rows, error }, { data: blocks, error: bErr }] = await Promise.all([
      supabase.from('yy_friendships').select('*').or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
      supabase.from('yy_user_blocks').select('blocked_id, created_at').eq('blocker_id', uid),
    ]);
    if (error) throw error;
    if (bErr) throw bErr;
    const other = (r) => (r.requester_id === uid ? r.addressee_id : r.requester_id);
    const users = await usersByIds([...new Set([...(rows || []).map(other), ...(blocks || []).map((b) => b.blocked_id)])]);
    const friends = []; const incoming = []; const outgoing = [];
    for (const r of rows || []) {
      const u = users.get(other(r));
      if (!u) continue;
      if (r.status === 'accepted') friends.push({ ...pub(u), since: r.accepted_at || r.created_at });
      else if (r.addressee_id === uid) incoming.push({ ...pub(u), at: r.created_at });
      else outgoing.push({ ...pub(u), at: r.created_at });
    }
    friends.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
    const blocked = (blocks || []).map((b) => users.get(b.blocked_id)).filter(Boolean).map(pub);
    return res.json({ me: { code: me.friend_code, name: me.username || null }, friends, incoming, outgoing, blocked });
  } catch (err) {
    return fail(res, 'overview', err, '讀取好友失敗');
  }
}

async function regenerateCode(req, res) {
  try {
    const me = await setNewCode({ id: req.user.id });
    return res.json({ code: me.friend_code });
  } catch (err) {
    return fail(res, 'regenerateCode', err, '更換好友碼失敗');
  }
}

// 依好友碼找人;封鎖、停用、找不到一律回「找不到」
async function findByCode(uid, rawCode) {
  const code = F.normalizeCode(rawCode);
  if (code.length !== F.CODE_LEN) return null;
  const { data: u, error } = await supabase.from('yy_users').select('id, username, is_disabled').eq('friend_code', code).maybeSingle();
  if (error) throw error;
  if (!u || u.is_disabled) return null;
  if (u.id !== uid && await F.isBlockedEither(uid, u.id)) return null;
  return u;
}

function relationOf(uid, row) {
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friend';
  return row.requester_id === uid ? 'outgoing' : 'incoming';
}

async function lookup(req, res) {
  try {
    const uid = req.user.id;
    const u = await findByCode(uid, req.query.code);
    if (!u) return res.status(404).json({ error: '找不到這組好友碼', code: 'NOT_FOUND' });
    if (u.id === uid) return res.json({ user: pub(u), relation: 'self' });
    return res.json({ user: pub(u), relation: relationOf(uid, await F.pairRow(uid, u.id)) });
  } catch (err) {
    return fail(res, 'lookup', err, '查詢失敗');
  }
}

async function countRows(filters) {
  let q = supabase.from('yy_friendships').select('id', { count: 'exact', head: true });
  q = filters(q);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function myName(uid) {
  const { data } = await supabase.from('yy_users').select('username').eq('id', uid).maybeSingle();
  return data?.username || 'YY手帳使用者';
}

const notify = (userId, title, body) => sendPushToUser(userId, { title, body, data: { url: '/community/friends' } })
  .catch((e) => console.error('[friendController] push failed', e.message));

async function request(req, res) {
  try {
    const uid = req.user.id;
    const u = await findByCode(uid, req.body?.code);
    if (!u) return res.status(404).json({ error: '找不到這組好友碼', code: 'NOT_FOUND' });
    if (u.id === uid) return res.status(400).json({ error: '這是你自己的好友碼' });

    const row = await F.pairRow(uid, u.id);
    if (row?.status === 'accepted') return res.json({ status: 'friend', user: pub(u) });
    if (row && row.requester_id === uid) return res.json({ status: 'outgoing', user: pub(u) });

    const friends = await countRows((q) => q.eq('status', 'accepted').or(`requester_id.eq.${uid},addressee_id.eq.${uid}`));
    if (friends >= MAX_FRIENDS) return res.status(400).json({ error: `好友最多 ${MAX_FRIENDS} 位` });

    // 對方已經邀請過我:直接成為好友
    if (row) {
      const { error } = await supabase.from('yy_friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', row.id);
      if (error) throw error;
      notify(u.id, '你們成為好友了 🦫', `${await myName(uid)} 接受了你的好友邀請`);
      return res.json({ status: 'friend', user: pub(u) });
    }

    const pending = await countRows((q) => q.eq('status', 'pending').eq('requester_id', uid));
    if (pending >= MAX_PENDING_OUT) return res.status(400).json({ error: '送出的邀請太多了，請等對方回覆或取消一些邀請' });

    const { error } = await supabase.from('yy_friendships').insert({ requester_id: uid, addressee_id: u.id, status: 'pending' });
    if (error && error.code !== '23505') throw error;
    notify(u.id, '有人想加你為好友 🦫', `${await myName(uid)} 想加你為好友`);
    return res.status(201).json({ status: 'outgoing', user: pub(u) });
  } catch (err) {
    return fail(res, 'request', err, '送出邀請失敗');
  }
}

async function accept(req, res) {
  try {
    const uid = req.user.id;
    const row = await F.pairRow(uid, req.params.userId);
    if (!row || row.status !== 'pending' || row.addressee_id !== uid) return res.status(404).json({ error: '找不到這個邀請' });
    const { error } = await supabase.from('yy_friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', row.id);
    if (error) throw error;
    notify(row.requester_id, '你們成為好友了 🦫', `${await myName(uid)} 接受了你的好友邀請`);
    return res.json({ status: 'friend' });
  } catch (err) {
    return fail(res, 'accept', err, '接受邀請失敗');
  }
}

// 拒絕邀請、取消邀請、解除好友都是刪掉關係
async function remove(req, res) {
  try {
    const row = await F.pairRow(req.user.id, req.params.userId);
    if (row) {
      const { error } = await supabase.from('yy_friendships').delete().eq('id', row.id);
      if (error) throw error;
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'remove', err, '操作失敗');
  }
}

async function blockUser(uid, otherId) {
  const row = await F.pairRow(uid, otherId);
  if (row) {
    const { error } = await supabase.from('yy_friendships').delete().eq('id', row.id);
    if (error) throw error;
  }
  const { error } = await supabase.from('yy_user_blocks').upsert({ blocker_id: uid, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) throw error;
}

async function exists(id) {
  const { data } = await supabase.from('yy_users').select('id').eq('id', id).maybeSingle();
  return !!data;
}

async function block(req, res) {
  try {
    const other = req.params.userId;
    if (other === req.user.id) return res.status(400).json({ error: '不能封鎖自己' });
    if (!(await exists(other))) return res.status(404).json({ error: '找不到這位使用者' });
    await blockUser(req.user.id, other);
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'block', err, '封鎖失敗');
  }
}

async function unblock(req, res) {
  try {
    const { error } = await supabase.from('yy_user_blocks').delete().eq('blocker_id', req.user.id).eq('blocked_id', req.params.userId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'unblock', err, '解除封鎖失敗');
  }
}

// 檢舉會同時封鎖對方
async function report(req, res) {
  try {
    const other = req.params.userId;
    if (other === req.user.id) return res.status(400).json({ error: '不能檢舉自己' });
    if (!(await exists(other))) return res.status(404).json({ error: '找不到這位使用者' });
    const reason = String(req.body?.reason || '').trim().slice(0, REPORT_MAX) || null;
    const { error } = await supabase.from('yy_user_reports').insert({ reporter_id: req.user.id, reported_id: other, reason, status: 'new' });
    if (error) throw error;
    await blockUser(req.user.id, other);
    return res.status(201).json({ ok: true });
  } catch (err) {
    return fail(res, 'report', err, '檢舉失敗');
  }
}

module.exports = { overview, regenerateCode, lookup, request, accept, remove, block, unblock, report };

const supabase = require('../config/supabase');
const L = require('../lib/ledgers');
const F = require('../lib/friends');
const { sendPushToUser } = require('../services/fcmService');

const MAX_MEMBERS = 10; // 建立者以外最多幾位成員(含邀請中)

function fail(res, where, err, msg) {
  console.error(`[ledgerController.${where}]`, err);
  return res.status(500).json({ error: msg });
}
const langOf = (req) => (String(req.get('x-lang') || '').toLowerCase() === 'en' ? 'en' : 'zh');
const cleanName = (v) => String(v || '').trim().slice(0, L.NAME_MAX);
const notFound = (res) => res.status(404).json({ error: '找不到這本帳本', code: 'LEDGER_NOT_FOUND' });

async function namesOf(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('yy_users').select('id, username').in('id', [...new Set(ids)]);
  if (error) throw error;
  return new Map((data || []).map((u) => [u.id, u.username || null]));
}

async function myName(uid) {
  const { data } = await supabase.from('yy_users').select('username').eq('id', uid).maybeSingle();
  return data?.username || 'YY手帳使用者';
}

// 帳本列表:自己建立的+加入的(含已退出、只能查看的)+收到的邀請
async function listLedgers(req, res) {
  try {
    const uid = req.user.id;
    await L.ensureDefault(uid, langOf(req));
    const [{ data: own, error: oErr }, { data: mine, error: mErr }] = await Promise.all([
      supabase.from('yy_ledgers').select('*').eq('user_id', uid),
      supabase.from('yy_ledger_members').select('*').eq('user_id', uid),
    ]);
    if (oErr) throw oErr;
    if (mErr) throw mErr;
    const joinedIds = (mine || []).filter((m) => m.status !== 'invited').map((m) => m.ledger_id);
    const inviteRows = (mine || []).filter((m) => m.status === 'invited');
    const otherIds = [...new Set([...joinedIds, ...inviteRows.map((m) => m.ledger_id)])];
    const { data: others, error: lErr } = otherIds.length ? await supabase.from('yy_ledgers').select('*').in('id', otherIds) : { data: [] };
    if (lErr) throw lErr;
    const all = [...(own || []), ...(others || []).filter((l) => joinedIds.includes(l.id))];

    // 每本帳本的成員(邀請中、已加入、已退出)
    const ids = all.map((l) => l.id);
    const { data: members, error: memErr } = ids.length ? await supabase.from('yy_ledger_members').select('*').in('ledger_id', ids) : { data: [] };
    if (memErr) throw memErr;
    const names = await namesOf([...all.map((l) => l.user_id), ...(members || []).map((m) => m.user_id), ...inviteRows.map((m) => m.invited_by).filter(Boolean)]);

    const ledgers = all.map((l) => {
      const ms = (members || []).filter((m) => m.ledger_id === l.id);
      const myRow = ms.find((m) => m.user_id === uid);
      const role = l.user_id === uid ? 'owner' : myRow?.status === 'active' ? 'member' : 'left';
      return {
        id: l.id,
        name: l.name,
        is_default: l.user_id === uid && l.is_default,
        role,
        can_write: role !== 'left',
        shared: ms.some((m) => m.status === 'active'),
        owner: { id: l.user_id, name: names.get(l.user_id) || null },
        members: ms.map((m) => ({ id: m.user_id, name: names.get(m.user_id) || null, status: m.status })),
        created_at: l.created_at,
      };
    }).sort((a, b) => (b.is_default - a.is_default) || ((a.role === 'left') - (b.role === 'left')) || a.created_at.localeCompare(b.created_at));

    const invites = inviteRows.map((m) => {
      const l = (others || []).find((x) => x.id === m.ledger_id);
      return l && { ledger_id: l.id, name: l.name, from: names.get(m.invited_by) || null, at: m.created_at };
    }).filter(Boolean);
    return res.json({ ledgers, invites });
  } catch (err) {
    return fail(res, 'listLedgers', err, '讀取帳本失敗');
  }
}

async function createLedger(req, res) {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: '請輸入帳本名稱' });
    await L.ensureDefault(req.user.id, langOf(req));
    const { count, error: cErr } = await supabase.from('yy_ledgers').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
    if (cErr) throw cErr;
    if (count >= L.MAX_LEDGERS) return res.status(400).json({ error: `帳本最多 ${L.MAX_LEDGERS} 本` });
    const { data, error } = await supabase.from('yy_ledgers').insert({ user_id: req.user.id, name, is_default: false }).select('*').single();
    if (error) throw error;
    return res.status(201).json({ ledger: { id: data.id, name: data.name, is_default: false, role: 'owner', can_write: true, shared: false, members: [], created_at: data.created_at } });
  } catch (err) {
    return fail(res, 'createLedger', err, '新增帳本失敗');
  }
}

// 成員之間權限相同:建立者與已加入的成員都可以改名、邀請好友
async function writable(req, res) {
  const acc = await L.accessOf(req.user.id, req.params.id);
  if (!acc) { notFound(res); return null; }
  if (!acc.canWrite) { res.status(403).json({ error: '這本帳本只能查看', code: 'LEDGER_READ_ONLY' }); return null; }
  return acc;
}

async function renameLedger(req, res) {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: '請輸入帳本名稱' });
    const acc = await writable(req, res);
    if (!acc) return undefined;
    const { error } = await supabase.from('yy_ledgers').update({ name }).eq('id', acc.ledger.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'renameLedger', err, '修改帳本失敗');
  }
}

async function memberRows(ledgerId) {
  const { data, error } = await supabase.from('yy_ledger_members').select('*').eq('ledger_id', ledgerId);
  if (error) throw error;
  return data || [];
}

async function deleteLedgerData(ledgerId) {
  for (const table of ['yy_transactions', 'yy_recurring_items', 'yy_budgets', 'yy_accounts', 'yy_ledger_members']) {
    const { error } = await supabase.from(table).delete().eq('ledger_id', ledgerId);
    if (error) throw error;
  }
  const { error } = await supabase.from('yy_ledgers').delete().eq('id', ledgerId);
  if (error) throw error;
}

// 刪除帳本:只有建立者、而且沒有其他成員時;共同帳本請用「退出」
async function deleteLedger(req, res) {
  try {
    const acc = await L.accessOf(req.user.id, req.params.id);
    if (!acc || acc.role !== 'owner') return notFound(res);
    const ledger = acc.ledger;
    if ((await memberRows(ledger.id)).some((m) => m.status === 'active')) {
      return res.status(400).json({ error: '共同帳本不能刪除，請使用「退出」', code: 'LEDGER_SHARED' });
    }
    const { data: mine, error: mErr } = await supabase.from('yy_ledgers').select('id, created_at').eq('user_id', req.user.id).order('created_at', { ascending: true });
    if (mErr) throw mErr;
    if ((mine || []).length <= 1) return res.status(400).json({ error: '至少要保留一本帳本' });
    await deleteLedgerData(ledger.id);
    // 刪掉的是預設帳本:最早建立的那本變成預設
    if (ledger.is_default) {
      const next = mine.find((l) => l.id !== ledger.id);
      const { error: dErr } = await supabase.from('yy_ledgers').update({ is_default: true }).eq('id', next.id);
      if (dErr) throw dErr;
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'deleteLedger', err, '刪除帳本失敗');
  }
}

// 邀請好友加入(建立者或成員都可以邀請自己的好友)
async function inviteMember(req, res) {
  try {
    const acc = await writable(req, res);
    if (!acc) return undefined;
    const uid = req.user.id;
    const friendId = String(req.body?.user_id || '');
    if (!friendId || friendId === uid || !(await F.areFriends(uid, friendId))) return res.status(400).json({ error: '只能邀請你的好友' });
    if (friendId === acc.ledger.user_id) return res.status(400).json({ error: '對方已經在這本帳本裡' });
    const rows = await memberRows(acc.ledger.id);
    const existing = rows.find((m) => m.user_id === friendId);
    if (existing?.status === 'active') return res.status(400).json({ error: '對方已經在這本帳本裡' });
    if (existing?.status === 'invited') return res.json({ status: 'invited' });
    if (rows.filter((m) => m.status !== 'left').length >= MAX_MEMBERS) return res.status(400).json({ error: `一本帳本最多 ${MAX_MEMBERS + 1} 人` });
    // 退出過的人重新邀請:改回邀請中
    const row = { ledger_id: acc.ledger.id, user_id: friendId, status: 'invited', invited_by: uid, created_at: new Date().toISOString(), joined_at: null, left_at: null };
    const { error } = existing
      ? await supabase.from('yy_ledger_members').update(row).eq('ledger_id', acc.ledger.id).eq('user_id', friendId)
      : await supabase.from('yy_ledger_members').insert(row);
    if (error) throw error;
    sendPushToUser(friendId, { title: '邀請你一起記帳 📒', body: `${await myName(uid)} 邀請你加入「${acc.ledger.name}」`, data: { url: '/transactions' } })
      .catch((e) => console.error('[ledgerController] push failed', e.message));
    return res.status(201).json({ status: 'invited' });
  } catch (err) {
    return fail(res, 'inviteMember', err, '邀請失敗');
  }
}

async function myRow(req) {
  const { data, error } = await supabase.from('yy_ledger_members').select('*').eq('ledger_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function notifyOthers(ledger, exceptId, title, body) {
  for (const id of (await L.activeUserIds(ledger)).filter((x) => x !== exceptId)) {
    sendPushToUser(id, { title, body, data: { url: '/transactions' } }).catch(() => {});
  }
}

async function acceptInvite(req, res) {
  try {
    const row = await myRow(req);
    if (!row || row.status !== 'invited') return res.status(404).json({ error: '找不到這個邀請' });
    const { error } = await supabase.from('yy_ledger_members').update({ status: 'active', joined_at: new Date().toISOString(), left_at: null })
      .eq('ledger_id', row.ledger_id).eq('user_id', req.user.id);
    if (error) throw error;
    const { data: ledger } = await supabase.from('yy_ledgers').select('*').eq('id', row.ledger_id).maybeSingle();
    if (ledger) await notifyOthers(ledger, req.user.id, '新成員加入 📒', `${await myName(req.user.id)} 加入了「${ledger.name}」`);
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'acceptInvite', err, '加入失敗');
  }
}

async function declineInvite(req, res) {
  try {
    const row = await myRow(req);
    if (!row || row.status !== 'invited') return res.status(404).json({ error: '找不到這個邀請' });
    const { error } = await supabase.from('yy_ledger_members').delete().eq('ledger_id', row.ledger_id).eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'declineInvite', err, '操作失敗');
  }
}

// 退出共同帳本:之後只能查看。建立者退出時,帳本交給最早加入的成員
async function leaveLedger(req, res) {
  try {
    const uid = req.user.id;
    const acc = await L.accessOf(uid, req.params.id);
    if (!acc) return notFound(res);
    if (acc.role === 'left') return res.json({ ok: true });
    const ledger = acc.ledger;
    const now = new Date().toISOString();
    if (acc.role === 'owner') {
      const active = (await memberRows(ledger.id)).filter((m) => m.status === 'active')
        .sort((a, b) => (a.joined_at || a.created_at).localeCompare(b.joined_at || b.created_at));
      if (!active.length) return res.status(400).json({ error: '這本帳本沒有其他成員，可以直接刪除', code: 'LEDGER_NOT_SHARED' });
      const heir = active[0];
      // 交給最早加入的成員;原建立者變成「已退出」
      const { error: e1 } = await supabase.from('yy_ledgers').update({ user_id: heir.user_id, is_default: false }).eq('id', ledger.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('yy_ledger_members').delete().eq('ledger_id', ledger.id).eq('user_id', heir.user_id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from('yy_ledger_members').insert({ ledger_id: ledger.id, user_id: uid, status: 'left', invited_by: null, created_at: ledger.created_at, joined_at: ledger.created_at, left_at: now });
      if (e3) throw e3;
      // 原本是預設帳本:幫原建立者補一本新的預設帳本
      if (ledger.is_default) await L.ensureDefault(uid, langOf(req));
    } else {
      const { error } = await supabase.from('yy_ledger_members').update({ status: 'left', left_at: now }).eq('ledger_id', ledger.id).eq('user_id', uid);
      if (error) throw error;
    }
    const { data: fresh } = await supabase.from('yy_ledgers').select('*').eq('id', ledger.id).maybeSingle();
    if (fresh) await notifyOthers(fresh, uid, '成員退出 📒', `${await myName(uid)} 退出了「${fresh.name}」`);
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'leaveLedger', err, '退出失敗');
  }
}

// 已退出的帳本從自己的清單移除(之後就看不到了)
async function hideLedger(req, res) {
  try {
    const row = await myRow(req);
    if (!row || row.status !== 'left') return notFound(res);
    const { error } = await supabase.from('yy_ledger_members').delete().eq('ledger_id', row.ledger_id).eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'hideLedger', err, '操作失敗');
  }
}

// 建立者把成員移出(或取消邀請):被移出的人就看不到這本帳本
async function removeMember(req, res) {
  try {
    const acc = await L.accessOf(req.user.id, req.params.id);
    if (!acc || acc.role !== 'owner') return res.status(403).json({ error: '只有帳本建立者可以移出成員' });
    const target = req.params.userId;
    const { data: row, error: rErr } = await supabase.from('yy_ledger_members').select('status').eq('ledger_id', acc.ledger.id).eq('user_id', target).maybeSingle();
    if (rErr) throw rErr;
    if (!row) return res.status(404).json({ error: '找不到這位成員' });
    const { error } = await supabase.from('yy_ledger_members').delete().eq('ledger_id', acc.ledger.id).eq('user_id', target);
    if (error) throw error;
    if (row.status === 'active') {
      sendPushToUser(target, { title: '帳本通知 📒', body: `你已被移出「${acc.ledger.name}」`, data: { url: '/transactions' } }).catch(() => {});
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'removeMember', err, '移出失敗');
  }
}

module.exports = { listLedgers, createLedger, renameLedger, deleteLedger, inviteMember, acceptInvite, declineInvite, leaveLedger, hideLedger, removeMember };

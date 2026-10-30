// 共用行事曆:建立、改名、刪除、邀請好友、加入/拒絕、退出、移出成員
const supabase = require('../config/supabase');
const C = require('../lib/calendars');
const F = require('../lib/friends');
const { sendPushToUser } = require('../services/fcmService');

function fail(res, where, err, msg) {
  console.error(`[calendarController.${where}]`, err);
  return res.status(500).json({ error: msg });
}
const cleanName = (v) => String(v || '').trim().slice(0, C.NAME_MAX);
const cleanColor = (v) => (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : null);
const notFound = (res) => res.status(404).json({ error: '找不到這本行事曆', code: 'CALENDAR_NOT_FOUND' });

async function namesOf(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const { data, error } = await supabase.from('yy_users').select('id, username').in('id', list);
  if (error) throw error;
  return new Map((data || []).map((u) => [u.id, u.username || null]));
}
const push = (ids, title, body) => Promise.all(ids.map((id) => sendPushToUser(id, { title, body, data: { url: '/calendar' } }).catch(() => {})));

// GET /calendars:我的共用行事曆+收到的邀請
async function list(req, res) {
  try {
    const uid = req.user.id;
    const [{ data: own, error: e1 }, { data: mine, error: e2 }] = await Promise.all([
      supabase.from('yy_calendars').select('*').eq('user_id', uid),
      supabase.from('yy_calendar_members').select('*').eq('user_id', uid),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const otherIds = (mine || []).map((m) => m.calendar_id);
    const { data: others, error: e3 } = otherIds.length ? await supabase.from('yy_calendars').select('*').in('id', otherIds) : { data: [] };
    if (e3) throw e3;
    const joined = new Set((mine || []).filter((m) => m.status === 'active').map((m) => m.calendar_id));
    const all = [...(own || []), ...(others || []).filter((c) => joined.has(c.id))];
    const ids = all.map((c) => c.id);
    const { data: ms, error: e4 } = ids.length ? await supabase.from('yy_calendar_members').select('*').in('calendar_id', ids) : { data: [] };
    if (e4) throw e4;
    const inviteRows = (mine || []).filter((m) => m.status === 'invited');
    const names = await namesOf([...all.map((c) => c.user_id), ...(ms || []).map((m) => m.user_id), ...inviteRows.map((m) => m.invited_by)]);
    const calendars = all.map((c) => ({
      id: c.id, name: c.name, color: c.color || C.COLORS[0],
      role: c.user_id === uid ? 'owner' : 'member',
      owner: { id: c.user_id, name: names.get(c.user_id) || null },
      members: (ms || []).filter((m) => m.calendar_id === c.id).map((m) => ({ id: m.user_id, name: names.get(m.user_id) || null, status: m.status })),
      created_at: c.created_at,
    })).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const invites = inviteRows.map((m) => {
      const c = (others || []).find((x) => x.id === m.calendar_id);
      return c && { calendar_id: c.id, name: c.name, from: names.get(m.invited_by) || null, at: m.created_at };
    }).filter(Boolean);
    return res.json({ calendars, invites, colors: C.COLORS });
  } catch (err) {
    return fail(res, 'list', err, '讀取行事曆失敗');
  }
}

// POST /calendars { name, color }
async function create(req, res) {
  try {
    const name = cleanName(req.body.name);
    if (!name) return res.status(400).json({ error: '請輸入行事曆名稱' });
    const { count } = await supabase.from('yy_calendars').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
    if ((count || 0) >= 10) return res.status(400).json({ error: '最多建立 10 本共用行事曆' });
    const { data, error } = await supabase.from('yy_calendars')
      .insert({ user_id: req.user.id, name, color: cleanColor(req.body.color) || C.COLORS[(count || 0) % C.COLORS.length] })
      .select('*').single();
    if (error) throw error;
    return res.status(201).json({ calendar: data });
  } catch (err) {
    return fail(res, 'create', err, '建立行事曆失敗');
  }
}

// PATCH /calendars/:id { name, color }:成員都可以改
async function update(req, res) {
  try {
    const acc = await C.accessOf(req.user.id, req.params.id);
    if (!acc) return notFound(res);
    const patch = {};
    if (req.body.name !== undefined) {
      const name = cleanName(req.body.name);
      if (!name) return res.status(400).json({ error: '請輸入行事曆名稱' });
      patch.name = name;
    }
    if (req.body.color !== undefined) {
      const color = cleanColor(req.body.color);
      if (!color) return res.status(400).json({ error: '顏色不正確' });
      patch.color = color;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' });
    const { data, error } = await supabase.from('yy_calendars').update(patch).eq('id', acc.cal.id).select('*').single();
    if (error) throw error;
    return res.json({ calendar: data });
  } catch (err) {
    return fail(res, 'update', err, '儲存失敗');
  }
}

// DELETE /calendars/:id:建立者刪除整本(所有行程一起刪除,通知成員)
async function remove(req, res) {
  try {
    const acc = await C.accessOf(req.user.id, req.params.id);
    if (!acc) return notFound(res);
    if (acc.role !== 'owner') return res.status(403).json({ error: '只有建立者可以刪除，你可以選擇退出' });
    const others = (await C.activeUserIds(acc.cal)).filter((x) => x !== req.user.id);
    const { error } = await supabase.from('yy_calendars').delete().eq('id', acc.cal.id);
    if (error) throw error;
    const who = (await namesOf([req.user.id])).get(req.user.id) || 'YY手帳使用者';
    if (others.length) await push(others, '共用行事曆 📅', `${who} 刪除了「${acc.cal.name}」`);
    return res.status(204).send();
  } catch (err) {
    return fail(res, 'remove', err, '刪除失敗');
  }
}

// POST /calendars/:id/invite { friend_id }:成員都可以邀請自己的好友
async function invite(req, res) {
  try {
    const acc = await C.accessOf(req.user.id, req.params.id);
    if (!acc) return notFound(res);
    const fid = String(req.body.friend_id || '');
    if (!fid || fid === acc.cal.user_id) return res.status(400).json({ error: '請選擇好友' });
    if (!(await F.areFriends(req.user.id, fid))) return res.status(400).json({ error: '只能邀請好友' });
    const { data: ms, error } = await supabase.from('yy_calendar_members').select('user_id').eq('calendar_id', acc.cal.id);
    if (error) throw error;
    if ((ms || []).some((m) => m.user_id === fid)) return res.status(400).json({ error: '已經邀請過了' });
    if ((ms || []).length >= C.MAX_MEMBERS) return res.status(400).json({ error: `一本行事曆最多 ${C.MAX_MEMBERS} 位成員` });
    const { error: iErr } = await supabase.from('yy_calendar_members').insert({ calendar_id: acc.cal.id, user_id: fid, status: 'invited', invited_by: req.user.id });
    if (iErr) throw iErr;
    const who = (await namesOf([req.user.id])).get(req.user.id) || 'YY手帳使用者';
    await push([fid], '共用行事曆邀請 📅', `${who} 邀請你加入「${acc.cal.name}」`);
    return res.status(201).json({ ok: true });
  } catch (err) {
    return fail(res, 'invite', err, '邀請失敗');
  }
}

async function myRow(req) {
  const { data, error } = await supabase.from('yy_calendar_members').select('*').eq('calendar_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

// POST /calendars/:id/accept
async function accept(req, res) {
  try {
    const row = await myRow(req);
    if (!row || row.status !== 'invited') return notFound(res);
    const { error } = await supabase.from('yy_calendar_members').update({ status: 'active', joined_at: new Date().toISOString() })
      .eq('calendar_id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    const { data: cal } = await supabase.from('yy_calendars').select('*').eq('id', req.params.id).maybeSingle();
    if (cal) {
      const others = (await C.activeUserIds(cal)).filter((x) => x !== req.user.id);
      const who = (await namesOf([req.user.id])).get(req.user.id) || 'YY手帳使用者';
      if (others.length) await push(others, '共用行事曆 📅', `${who} 加入了「${cal.name}」`);
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'accept', err, '加入失敗');
  }
}

// POST /calendars/:id/decline
async function decline(req, res) {
  try {
    const row = await myRow(req);
    if (!row || row.status !== 'invited') return notFound(res);
    const { error } = await supabase.from('yy_calendar_members').delete().eq('calendar_id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'decline', err, '操作失敗');
  }
}

// POST /calendars/:id/leave:成員退出;建立者退出時交給最早加入的成員(沒有成員就刪除)
async function leave(req, res) {
  try {
    const acc = await C.accessOf(req.user.id, req.params.id);
    if (!acc) return notFound(res);
    const who = (await namesOf([req.user.id])).get(req.user.id) || 'YY手帳使用者';
    if (acc.role === 'owner') {
      const heir = await C.handOver(acc.cal);
      if (heir) {
        const others = (await C.activeUserIds({ ...acc.cal, user_id: heir })).filter((x) => x !== req.user.id);
        await push(others, '共用行事曆 📅', `${who} 退出了「${acc.cal.name}」`);
      }
    } else {
      const { error } = await supabase.from('yy_calendar_members').delete().eq('calendar_id', acc.cal.id).eq('user_id', req.user.id);
      if (error) throw error;
      const others = (await C.activeUserIds(acc.cal)).filter((x) => x !== req.user.id);
      await push(others, '共用行事曆 📅', `${who} 退出了「${acc.cal.name}」`);
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'leave', err, '退出失敗');
  }
}

// DELETE /calendars/:id/members/:userId:建立者移出成員(或取消邀請)
async function removeMember(req, res) {
  try {
    const acc = await C.accessOf(req.user.id, req.params.id);
    if (!acc) return notFound(res);
    if (acc.role !== 'owner') return res.status(403).json({ error: '只有建立者可以移出成員' });
    const { error } = await supabase.from('yy_calendar_members').delete().eq('calendar_id', acc.cal.id).eq('user_id', req.params.userId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'removeMember', err, '移出失敗');
  }
}

module.exports = { list, create, update, remove, invite, accept, decline, leave, removeMember };

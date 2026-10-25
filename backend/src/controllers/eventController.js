const supabase = require('../config/supabase');
const F = require('../lib/friends');
const { sendPushToUser } = require('../services/fcmService');

// 提醒選項(分鐘):null 不提醒、0 準時、10/30/60 分鐘前、1440 一天前;
// 全天行程:-480 = 當天早上 8 點、960 = 前一天早上 8 點
const REMIND_OPTIONS = [null, 0, 10, 30, 60, 1440, -480, 960];
const validRemind = (v) => v === undefined || REMIND_OPTIONS.includes(v);
const MAX_INVITES = 30; // 一個行程最多邀請幾位(不含建立者)

function fail(res, where, err, msg) {
  console.error(`[eventController.${where}]`, err);
  return res.status(500).json({ error: msg });
}

async function namesOf(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const { data, error } = await supabase.from('yy_users').select('id, username').in('id', list);
  if (error) throw error;
  return new Map((data || []).map((u) => [u.id, u.username || null]));
}
async function myName(uid) {
  return (await namesOf([uid])).get(uid) || 'YY手帳使用者';
}

function dateLabel(ev) {
  const d = new Date(ev.start_at);
  const date = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return time === '00:00' ? date : `${date} ${time}`;
}

// 行程的參與者:建立者+已參加的成員
async function participantIds(ev) {
  const { data, error } = await supabase.from('yy_event_members').select('user_id').eq('event_id', ev.id).eq('status', 'active');
  if (error) throw error;
  return [ev.user_id, ...(data || []).map((m) => m.user_id)];
}
const notify = (ids, title, body) => Promise.all(ids.map((id) => sendPushToUser(id, { title, body, data: { url: '/calendar' } }).catch(() => {})));

// 可以看/改的行程:自己建立的,或已參加的共同行程
async function accessible(userId, id) {
  const { data: ev, error } = await supabase.from('yy_events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!ev) return null;
  if (ev.user_id === userId) return { ev, role: 'owner' };
  const { data: m } = await supabase.from('yy_event_members').select('status').eq('event_id', id).eq('user_id', userId).maybeSingle();
  return m?.status === 'active' ? { ev, role: 'member' } : null;
}

// 補上共同行程的資訊(建立者、成員)
async function decorate(events, userId) {
  const ids = events.map((e) => e.id);
  if (!ids.length) return [];
  const { data: ms, error } = await supabase.from('yy_event_members').select('event_id, user_id, status').in('event_id', ids);
  if (error) throw error;
  const names = await namesOf([...events.map((e) => e.user_id), ...(ms || []).map((m) => m.user_id)]);
  return events.map((e) => {
    const members = (ms || []).filter((m) => m.event_id === e.id).map((m) => ({ id: m.user_id, name: names.get(m.user_id) || null, status: m.status }));
    return {
      ...e,
      is_owner: e.user_id === userId,
      shared: members.length > 0,
      owner: { id: e.user_id, name: names.get(e.user_id) || null },
      members,
    };
  });
}

async function listEvents(req, res) {
  try {
    const { from, to } = req.query;
    const uid = req.user.id;
    const { data: mine, error: mErr } = await supabase.from('yy_event_members').select('event_id').eq('user_id', uid).eq('status', 'active');
    if (mErr) throw mErr;
    const joined = (mine || []).map((m) => m.event_id);

    let query = supabase
      .from('yy_events')
      .select('*')
      // 自己的行程+已參加的共同行程
      .or(joined.length ? `user_id.eq.${uid},id.in.(${joined.join(',')})` : `user_id.eq.${uid}`)
      .order('start_at', { ascending: true });

    // 跨日行程:只要和查詢區間有重疊就列出(結束時間在 from 之後、開始時間在 to 之前)
    const valid = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
    if (valid(from)) {
      const f = new Date(from).toISOString();
      query = query.or(`end_at.gte."${f}",and(end_at.is.null,start_at.gte."${f}")`);
    }
    if (valid(to)) query = query.lte('start_at', new Date(to).toISOString());

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ events: await decorate(data || [], uid) });
  } catch (err) {
    return fail(res, 'listEvents', err, 'Failed to fetch events');
  }
}

// 邀請好友(只能邀請自己的好友;已在行程裡的略過)
async function inviteFriends(ev, inviterId, ids) {
  const want = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => id && id !== inviterId && id !== ev.user_id);
  if (!want.length) return 0;
  const { data: existing } = await supabase.from('yy_event_members').select('user_id').eq('event_id', ev.id);
  const have = new Set((existing || []).map((m) => m.user_id));
  if (have.size + want.length > MAX_INVITES) {
    const err = new Error(`一個行程最多邀請 ${MAX_INVITES} 位`); err.status = 400; throw err;
  }
  const rows = [];
  for (const id of want) {
    if (have.has(id)) continue;
    if (!(await F.areFriends(inviterId, id))) continue;
    rows.push({ event_id: ev.id, user_id: id, status: 'invited', invited_by: inviterId });
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from('yy_event_members').insert(rows);
  if (error) throw error;
  const who = await myName(inviterId);
  await notify(rows.map((r) => r.user_id), '行程邀請 📅', `${who} 邀請你參加「${ev.title}」（${dateLabel(ev)}）`);
  return rows.length;
}

async function createEvent(req, res) {
  try {
    const { title, start_at, end_at, category, color, note, remind_before_minutes } = req.body;
    if (!title || !start_at) {
      return res.status(400).json({ error: 'title and start_at are required' });
    }
    if (!validRemind(remind_before_minutes)) return res.status(400).json({ error: 'Invalid reminder' });

    const { data, error } = await supabase
      .from('yy_events')
      .insert({
        user_id: req.user.id,
        title,
        start_at,
        // 結束時間不得早於開始時間
        end_at: end_at && end_at > start_at ? end_at : start_at,
        category: category || null,
        color: color || null, // hex string chosen by the user for this category
        note: note || null,
        source: 'app', // vs 'google' once phase-2 sync lands
        remind_before_minutes: remind_before_minutes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    const invited = await inviteFriends(data, req.user.id, req.body.invite_ids);
    return res.status(201).json({ event: data, invited });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return fail(res, 'createEvent', err, 'Failed to create event');
  }
}

// 共同行程:所有參與者都可以修改,並通知其他人
async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const acc = await accessible(req.user.id, id);
    if (!acc) return res.status(404).json({ error: 'Event not found' });
    // 只允許更新這些欄位(不能改 user_id 等);分類與顏色屬於建立者
    const keys = ['title', 'start_at', 'end_at', 'note', 'remind_before_minutes', ...(acc.role === 'owner' ? ['category', 'color'] : [])];
    const updates = {};
    for (const k of keys) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (!validRemind(updates.remind_before_minutes)) return res.status(400).json({ error: 'Invalid reminder' });
    // 時間或提醒設定改了 → 重新排定提醒
    if (updates.start_at !== undefined || updates.remind_before_minutes !== undefined) updates.reminder_sent_at = null;
    const hasInvites = Array.isArray(req.body.invite_ids) && req.body.invite_ids.length > 0;
    if (Object.keys(updates).length === 0 && !hasInvites) return res.status(400).json({ error: 'Nothing to update' });
    let data = acc.ev;
    if (Object.keys(updates).length) {
      const r = await supabase.from('yy_events').update(updates).eq('id', id).select().maybeSingle();
      if (r.error) throw r.error;
      data = r.data;
    }
    const invited = await inviteFriends(data, req.user.id, req.body.invite_ids);
    // 內容有改:通知其他參與者
    const changed = ['title', 'start_at', 'end_at', 'note'].some((k) => updates[k] !== undefined && String(updates[k] ?? '') !== String(acc.ev[k] ?? ''));
    if (changed) {
      const others = (await participantIds(data)).filter((x) => x !== req.user.id);
      if (others.length) await notify(others, '行程更新 📅', `${await myName(req.user.id)} 修改了「${data.title}」（${dateLabel(data)}）`);
    }
    return res.json({ event: data, invited });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return fail(res, 'updateEvent', err, 'Failed to update event');
  }
}

// 建立者刪除:所有人的行程都刪除;參與者刪除:自己退出這個行程
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const acc = await accessible(req.user.id, id);
    if (!acc) return res.status(204).send();
    if (acc.role === 'owner') {
      const others = (await participantIds(acc.ev)).filter((x) => x !== req.user.id);
      const { error } = await supabase.from('yy_events').delete().eq('id', id);
      if (error) throw error;
      if (others.length) await notify(others, '行程取消 📅', `${await myName(req.user.id)} 取消了「${acc.ev.title}」（${dateLabel(acc.ev)}）`);
    } else {
      const { error } = await supabase.from('yy_event_members').delete().eq('event_id', id).eq('user_id', req.user.id);
      if (error) throw error;
      const others = (await participantIds(acc.ev)).filter((x) => x !== req.user.id);
      if (others.length) await notify(others, '行程通知 📅', `${await myName(req.user.id)} 不參加「${acc.ev.title}」了`);
    }
    return res.status(204).send();
  } catch (err) {
    return fail(res, 'deleteEvent', err, 'Failed to delete event');
  }
}

// 收到的行程邀請
async function listInvites(req, res) {
  try {
    const { data: rows, error } = await supabase.from('yy_event_members').select('*').eq('user_id', req.user.id).eq('status', 'invited');
    if (error) throw error;
    if (!rows?.length) return res.json({ invites: [] });
    const { data: evs, error: eErr } = await supabase.from('yy_events').select('*').in('id', rows.map((r) => r.event_id));
    if (eErr) throw eErr;
    const names = await namesOf(rows.map((r) => r.invited_by));
    const invites = rows.map((r) => {
      const ev = (evs || []).find((e) => e.id === r.event_id);
      return ev && { event_id: ev.id, title: ev.title, start_at: ev.start_at, end_at: ev.end_at, from: names.get(r.invited_by) || null };
    }).filter(Boolean).sort((a, b) => a.start_at.localeCompare(b.start_at));
    return res.json({ invites });
  } catch (err) {
    return fail(res, 'listInvites', err, '讀取邀請失敗');
  }
}

async function myInvite(req) {
  const { data, error } = await supabase.from('yy_event_members').select('*').eq('event_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (error) throw error;
  return data?.status === 'invited' ? data : null;
}

async function acceptInvite(req, res) {
  try {
    const row = await myInvite(req);
    if (!row) return res.status(404).json({ error: '找不到這個邀請' });
    const { error } = await supabase.from('yy_event_members').update({ status: 'active', joined_at: new Date().toISOString() })
      .eq('event_id', row.event_id).eq('user_id', req.user.id);
    if (error) throw error;
    const { data: ev } = await supabase.from('yy_events').select('*').eq('id', row.event_id).maybeSingle();
    if (ev) {
      const others = (await participantIds(ev)).filter((x) => x !== req.user.id);
      await notify(others, '行程通知 📅', `${await myName(req.user.id)} 會參加「${ev.title}」`);
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'acceptInvite', err, '回覆失敗');
  }
}

async function declineInvite(req, res) {
  try {
    const row = await myInvite(req);
    if (!row) return res.status(404).json({ error: '找不到這個邀請' });
    const { error } = await supabase.from('yy_event_members').delete().eq('event_id', row.event_id).eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'declineInvite', err, '回覆失敗');
  }
}

// 建立者把人移出(或取消邀請)
async function removeMember(req, res) {
  try {
    const acc = await accessible(req.user.id, req.params.id);
    if (!acc || acc.role !== 'owner') return res.status(403).json({ error: '只有行程建立者可以移出成員' });
    const { error } = await supabase.from('yy_event_members').delete().eq('event_id', req.params.id).eq('user_id', req.params.userId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'removeMember', err, '移出失敗');
  }
}

module.exports = { listEvents, createEvent, updateEvent, deleteEvent, listInvites, acceptInvite, declineInvite, removeMember, participantIds };

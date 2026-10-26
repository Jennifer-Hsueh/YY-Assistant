const supabase = require('../config/supabase');
const F = require('../lib/friends');
const A = require('../lib/annualDates');
const { sendPushToUser } = require('../services/fcmService');

const REMINDS = ['none', 'day', 'day_3'];
const ICON_RE = /^a(0[1-9]|1[0-6])$/; // 內建圖示 a01～a16
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_INVITES = 30;

function fail(res, where, err, msg) {
  console.error(`[anniversaryController.${where}]`, err);
  return res.status(500).json({ error: msg });
}
async function namesOf(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const { data, error } = await supabase.from('yy_users').select('id, username').in('id', list);
  if (error) throw error;
  return new Map((data || []).map((u) => [u.id, u.username || null]));
}
const myName = async (uid) => (await namesOf([uid])).get(uid) || 'YY手帳使用者';
const notify = (ids, title, body) => Promise.all(ids.map((id) => sendPushToUser(id, { title, body, data: { url: '/anniversaries' } }).catch(() => {})));

async function participants(a) {
  const { data, error } = await supabase.from('yy_anniversary_members').select('user_id').eq('anniversary_id', a.id).eq('status', 'active');
  if (error) throw error;
  return [a.user_id, ...(data || []).map((m) => m.user_id)];
}

async function accessible(uid, id) {
  const { data: a, error } = await supabase.from('yy_anniversaries').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!a) return null;
  if (a.user_id === uid) return { a, role: 'owner' };
  const { data: m } = await supabase.from('yy_anniversary_members').select('status').eq('anniversary_id', id).eq('user_id', uid).maybeSingle();
  return m?.status === 'active' ? { a, role: 'member' } : null;
}

// 紀念日(自己的+參加的)、收到的邀請、好友生日
async function listAll(req, res) {
  try {
    const uid = req.user.id;
    const today = A.taipeiToday();
    const { data: mine, error: mErr } = await supabase.from('yy_anniversary_members').select('*').eq('user_id', uid);
    if (mErr) throw mErr;
    const joined = (mine || []).filter((m) => m.status === 'active').map((m) => m.anniversary_id);
    const invitedRows = (mine || []).filter((m) => m.status === 'invited');
    const ids = [...joined, ...invitedRows.map((m) => m.anniversary_id)];
    let q = supabase.from('yy_anniversaries').select('*');
    q = ids.length ? q.or(`user_id.eq.${uid},id.in.(${ids.join(',')})`) : q.eq('user_id', uid);
    const { data: rows, error } = await q;
    if (error) throw error;
    const all = rows || [];
    const visible = all.filter((a) => a.user_id === uid || joined.includes(a.id));
    const { data: ms, error: msErr } = visible.length
      ? await supabase.from('yy_anniversary_members').select('*').in('anniversary_id', visible.map((a) => a.id))
      : { data: [] };
    if (msErr) throw msErr;

    // 好友生日(對方有公開的才列出)
    const friendIds = await F.friendIds(uid);
    const { data: friends, error: fErr } = friendIds.length
      ? await supabase.from('yy_users').select('id, username, birthday_md, birthday_visible, is_disabled').in('id', friendIds)
      : { data: [] };
    if (fErr) throw fErr;

    const names = await namesOf([...all.map((a) => a.user_id), ...(ms || []).map((m) => m.user_id), ...invitedRows.map((m) => m.invited_by)]);
    const anniversaries = visible.map((a) => ({
      id: a.id, title: a.title, date: a.date, remind: a.remind, note: a.note, icon: a.icon || null,
      recurring: a.recurring !== false, show_years: a.show_years !== false, show_age: !!a.show_age, year_known: a.year_known !== false,
      is_owner: a.user_id === uid,
      owner: { id: a.user_id, name: names.get(a.user_id) || null },
      members: (ms || []).filter((m) => m.anniversary_id === a.id).map((m) => ({ id: m.user_id, name: names.get(m.user_id) || null, status: m.status })),
      ...A.anniversaryInfo(a, today),
    })).sort((x, y) => ((x.days_left < 0) - (y.days_left < 0)) || (x.days_left < 0 ? y.days_left - x.days_left : x.days_left - y.days_left));
    const invites = invitedRows.map((m) => {
      const a = all.find((x) => x.id === m.anniversary_id);
      return a && { id: a.id, title: a.title, date: a.date, icon: a.icon || null, from: names.get(m.invited_by) || null };
    }).filter(Boolean);
    const birthdays = (friends || []).filter((f) => f.birthday_md && f.birthday_visible && !f.is_disabled)
      .map((f) => ({ id: f.id, name: f.username || null, md: f.birthday_md, ...A.nextOf(f.birthday_md, today) }))
      .sort((x, y) => x.days_left - y.days_left);
    return res.json({ anniversaries, invites, birthdays, today });
  } catch (err) {
    return fail(res, 'listAll', err, '讀取紀念日失敗');
  }
}

async function inviteFriends(a, inviterId, ids) {
  const want = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => id && id !== inviterId && id !== a.user_id);
  if (!want.length) return 0;
  const { data: existing } = await supabase.from('yy_anniversary_members').select('user_id').eq('anniversary_id', a.id);
  const have = new Set((existing || []).map((m) => m.user_id));
  if (have.size + want.length > MAX_INVITES) { const e = new Error(`一個紀念日最多邀請 ${MAX_INVITES} 位`); e.status = 400; throw e; }
  const rows = [];
  for (const id of want) {
    if (have.has(id) || !(await F.areFriends(inviterId, id))) continue;
    rows.push({ anniversary_id: a.id, user_id: id, status: 'invited', invited_by: inviterId });
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from('yy_anniversary_members').insert(rows);
  if (error) throw error;
  await notify(rows.map((r) => r.user_id), '紀念日邀請 💝', `${await myName(inviterId)} 邀請你一起記住「${a.title}」`);
  return rows.length;
}

function clean(body, partial) {
  const out = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim().slice(0, 50);
    if (!title) return { error: '請輸入紀念日名稱' };
    out.title = title;
  }
  if (!partial || body.date !== undefined) {
    if (!DATE_RE.test(body.date || '') || Number.isNaN(Date.parse(body.date))) return { error: '日期格式不正確' };
    out.date = body.date;
  }
  if (body.remind !== undefined) {
    if (!REMINDS.includes(body.remind)) return { error: '提醒設定不正確' };
    out.remind = body.remind;
  }
  if (body.note !== undefined) out.note = String(body.note || '').trim().slice(0, 300) || null;
  if (body.icon !== undefined) {
    if (body.icon !== null && !ICON_RE.test(body.icon)) return { error: '圖示不正確' };
    out.icon = body.icon;
  }
  for (const k of ['recurring', 'show_years', 'show_age', 'year_known']) {
    if (body[k] !== undefined) out[k] = !!body[k];
  }
  // 不知道年份:用 2000 年(閏年,2/29 也能存)當代表,只取月日
  if (out.year_known === false && out.date) out.date = `2000-${out.date.slice(5, 10)}`;
  if (out.year_known === false) out.recurring = true;
  return { out };
}

async function create(req, res) {
  try {
    const { error: vErr, out } = clean(req.body || {}, false);
    if (vErr) return res.status(400).json({ error: vErr });
    const { data, error } = await supabase.from('yy_anniversaries').insert({ user_id: req.user.id, remind: 'day', ...out }).select().single();
    if (error) throw error;
    const invited = await inviteFriends(data, req.user.id, req.body.invite_ids);
    return res.status(201).json({ anniversary: data, invited });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return fail(res, 'create', err, '新增紀念日失敗');
  }
}

// 所有參與者都可以修改
async function update(req, res) {
  try {
    const acc = await accessible(req.user.id, req.params.id);
    if (!acc) return res.status(404).json({ error: '找不到這個紀念日' });
    const { error: vErr, out } = clean(req.body || {}, true);
    if (vErr) return res.status(400).json({ error: vErr });
    let data = acc.a;
    if (Object.keys(out).length) {
      const r = await supabase.from('yy_anniversaries').update(out).eq('id', acc.a.id).select().single();
      if (r.error) throw r.error;
      data = r.data;
    }
    const invited = await inviteFriends(data, req.user.id, req.body.invite_ids);
    return res.json({ anniversary: data, invited });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return fail(res, 'update', err, '修改紀念日失敗');
  }
}

// 建立者刪除:所有人都刪除;參與者刪除:自己退出
async function remove(req, res) {
  try {
    const acc = await accessible(req.user.id, req.params.id);
    if (!acc) return res.json({ ok: true });
    if (acc.role === 'owner') {
      const { error } = await supabase.from('yy_anniversaries').delete().eq('id', acc.a.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('yy_anniversary_members').delete().eq('anniversary_id', acc.a.id).eq('user_id', req.user.id);
      if (error) throw error;
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'remove', err, '刪除紀念日失敗');
  }
}

async function myInvite(req) {
  const { data, error } = await supabase.from('yy_anniversary_members').select('*').eq('anniversary_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (error) throw error;
  return data?.status === 'invited' ? data : null;
}
async function accept(req, res) {
  try {
    const row = await myInvite(req);
    if (!row) return res.status(404).json({ error: '找不到這個邀請' });
    const { error } = await supabase.from('yy_anniversary_members').update({ status: 'active' }).eq('anniversary_id', row.anniversary_id).eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'accept', err, '回覆失敗');
  }
}
async function decline(req, res) {
  try {
    const row = await myInvite(req);
    if (!row) return res.status(404).json({ error: '找不到這個邀請' });
    const { error } = await supabase.from('yy_anniversary_members').delete().eq('anniversary_id', row.anniversary_id).eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'decline', err, '回覆失敗');
  }
}
async function removeMember(req, res) {
  try {
    const acc = await accessible(req.user.id, req.params.id);
    if (!acc || acc.role !== 'owner') return res.status(403).json({ error: '只有建立者可以移出成員' });
    const { error } = await supabase.from('yy_anniversary_members').delete().eq('anniversary_id', acc.a.id).eq('user_id', req.params.userId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'removeMember', err, '移出失敗');
  }
}

module.exports = { listAll, create, update, remove, accept, decline, removeMember, participants };

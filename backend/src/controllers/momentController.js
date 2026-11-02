// 日常時光:使用者自己上傳的生活照片(只有自己看得到);完整版才能新增
// 照片存在社群照片同一個私人 bucket 的使用者資料夾(刪帳號時一起清掉)
const supabase = require('../config/supabase');
const images = require('../services/communityImages');

const MAX_PER_DAY = 9;
const CAPTION_MAX = 60;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isYm = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
const taipeiToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const nextYm = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };

function fail(res, where, err, msg) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  console.error(`[momentController.${where}]`, err);
  return res.status(500).json({ error: msg });
}

async function signed(rows) {
  const posts = await images.signPosts(rows.map((r) => ({ id: r.id, images: [r.image_key] })));
  const byId = Object.fromEntries(posts.map((p) => [p.id, p.images[0] || null]));
  return rows.map((r) => ({ id: r.id, date: r.date, caption: r.caption || '', created_at: r.created_at, url: byId[r.id]?.url || null, thumb: byId[r.id]?.thumb || null }));
}

// GET /moments?month=YYYY-MM
async function list(req, res) {
  try {
    const ym = isYm(req.query.month) ? req.query.month : taipeiToday().slice(0, 7);
    const { data, error } = await supabase.from('yy_moments').select('*').eq('user_id', req.user.id)
      .gte('date', `${ym}-01`).lt('date', `${nextYm(ym)}-01`).order('date').order('created_at');
    if (error) throw error;
    return res.json({ moments: await signed(data || []), max_per_day: MAX_PER_DAY });
  } catch (err) {
    return fail(res, 'list', err, '讀取日常時光失敗');
  }
}

// POST /moments { date, image, thumb, caption }
async function create(req, res) {
  try {
    const date = String(req.body?.date || '');
    if (!isDate(date) || date > taipeiToday()) return res.status(400).json({ error: '日期不正確' });
    const caption = String(req.body?.caption || '').replace(/\s+/g, ' ').trim();
    if ([...caption].length > CAPTION_MAX) return res.status(400).json({ error: `一句話最多 ${CAPTION_MAX} 個字` });
    const { count, error: cErr } = await supabase.from('yy_moments').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('date', date);
    if (cErr) throw cErr;
    if ((count || 0) >= MAX_PER_DAY) return res.status(400).json({ error: `同一天最多 ${MAX_PER_DAY} 張` });
    const key = await images.uploadImage(req.user.id, req.body?.image, req.body?.thumb);
    const { data, error } = await supabase.from('yy_moments').insert({ user_id: req.user.id, date, image_key: key, caption: caption || null }).select('*').single();
    if (error) { await images.removeImages([key]); throw error; }
    const [moment] = await signed([data]);
    return res.status(201).json({ moment });
  } catch (err) {
    return fail(res, 'create', err, '上傳失敗');
  }
}

// DELETE /moments/:id
async function remove(req, res) {
  try {
    const { data, error } = await supabase.from('yy_moments').select('*').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這張照片' });
    const { error: dErr } = await supabase.from('yy_moments').delete().eq('id', data.id);
    if (dErr) throw dErr;
    await images.removeImages([data.image_key]);
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'remove', err, '刪除失敗');
  }
}

module.exports = { list, create, remove, MAX_PER_DAY, CAPTION_MAX };

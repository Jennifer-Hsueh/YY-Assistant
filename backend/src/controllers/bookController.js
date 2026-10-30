// 月刊書櫃 API
const supabase = require('../config/supabase');
const B = require('../services/monthlyBook');
const { signPosts } = require('../services/communityImages');

function fail(res, where, err, msg) {
  console.error(`[bookController.${where}]`, err);
  return res.status(500).json({ error: msg });
}

async function rowOf(uid, ym) {
  const { data, error } = await supabase.from('yy_monthly_books').select('*').eq('user_id', uid).eq('ym', ym).maybeSingle();
  if (error) throw error;
  return data;
}

const brief = (r) => ({
  ym: r.ym, status: r.status, cover: r.cover || null, message: r.message || '',
  deadline: B.deadlineOf(r.ym).toISOString(), finalized_at: r.finalized_at || null,
});

// GET /books:書櫃上的書(新的在後)
async function list(req, res) {
  try {
    await B.ensureBooks(req.user.id);
    const { data, error } = await supabase.from('yy_monthly_books').select('ym, status, cover, message, finalized_at')
      .eq('user_id', req.user.id).order('ym');
    if (error) throw error;
    return res.json({ books: (data || []).map(brief) });
  } catch (err) {
    return fail(res, 'list', err, '讀取書櫃失敗');
  }
}

// GET /books/:ym:整本書的內容(草稿即時整理,定稿用快照);照片換成暫時網址
async function get(req, res) {
  try {
    const { ym } = req.params;
    if (!B.isYm(ym)) return res.status(400).json({ error: '月份格式不正確' });
    await B.ensureBooks(req.user.id);
    const row = await rowOf(req.user.id, ym);
    if (!row) return res.status(404).json({ error: '找不到這本書' });
    const data = row.status === 'final' && row.data ? row.data : await B.buildBookData(req.user.id, ym);
    const posts = await signPosts(data.posts || []);
    return res.json({ book: { ...brief(row), cover: row.cover || null, default_cover: B.defaultCover(ym), data: { ...data, posts } } });
  } catch (err) {
    return fail(res, 'get', err, '讀取這本書失敗');
  }
}

async function editable(req, res) {
  const { ym } = req.params;
  if (!B.isYm(ym)) { res.status(400).json({ error: '月份格式不正確' }); return null; }
  const row = await rowOf(req.user.id, ym);
  if (!row) { res.status(404).json({ error: '找不到這本書' }); return null; }
  if (row.status !== 'draft' || new Date() >= B.deadlineOf(ym)) { res.status(409).json({ error: '這本書已經定稿，不能再修改', code: 'BOOK_FINAL' }); return null; }
  return row;
}

// PATCH /books/:ym { cover, message }:草稿才能改
async function update(req, res) {
  try {
    const row = await editable(req, res);
    if (!row) return undefined;
    const patch = {};
    if (req.body.cover !== undefined) {
      const c = Number(req.body.cover);
      if (!Number.isInteger(c) || c < 1 || c > B.COVERS) return res.status(400).json({ error: '封面不正確' });
      patch.cover = c;
    }
    if (req.body.message !== undefined) {
      const m = String(req.body.message || '').replace(/\r\n/g, '\n').trim();
      if ([...m].length > B.MESSAGE_MAX) return res.status(400).json({ error: `最多 ${B.MESSAGE_MAX} 個字` });
      patch.message = m || null;
    }
    const { data, error } = await supabase.from('yy_monthly_books').update(patch).eq('id', row.id).select('*').single();
    if (error) throw error;
    return res.json({ book: brief(data) });
  } catch (err) {
    return fail(res, 'update', err, '儲存失敗');
  }
}

// POST /books/:ym/finalize:按「完成」提早定稿
async function finalize(req, res) {
  try {
    const row = await editable(req, res);
    if (!row) return undefined;
    const saved = await B.finalize(row);
    return res.json({ book: brief(saved) });
  } catch (err) {
    return fail(res, 'finalize', err, '定稿失敗');
  }
}

module.exports = { list, get, update, finalize };

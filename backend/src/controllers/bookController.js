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
  ym: r.ym, status: r.status, message: r.message || '',
  deadline: B.deadlineOf(r.ym).toISOString(), finalized_at: r.finalized_at || null,
});

// GET /books:書櫃上的書(新的在後);書櫃由前端依本數自動排(從小書櫃開始,放滿換大的)
async function list(req, res) {
  try {
    await B.ensureBooks(req.user.id);
    const { data, error } = await supabase.from('yy_monthly_books').select('ym, status, cover, message, finalized_at')
      .eq('user_id', req.user.id);
    if (error) throw error;
    const sorted = (data || []).sort((a, b) => B.sortKey(a.ym).localeCompare(B.sortKey(b.ym)));
    return res.json({ books: sorted.map(brief) });
  } catch (err) {
    return fail(res, 'list', err, '讀取書櫃失敗');
  }
}

// GET /books/:ym:整本書的內容(草稿即時整理,定稿用快照);照片換成暫時網址
async function get(req, res) {
  try {
    const { ym } = req.params;
    if (!B.isKey(ym)) return res.status(400).json({ error: '月份格式不正確' });
    await B.ensureBooks(req.user.id);
    const row = await rowOf(req.user.id, ym);
    if (!row) return res.status(404).json({ error: '找不到這本書' });
    const data = row.status === 'final' && row.data ? row.data : await B.buildFor(row);
    const posts = await signPosts(data.posts || []);
    // 日常時光的照片:換成暫時網址(縮圖);照片已刪掉的那天就顯示心情
    const photoDays = Object.entries(data.photos || {});
    const signedPhotos = photoDays.length ? await signPosts(photoDays.map(([date, key]) => ({ date, images: [key] }))) : [];
    const photo_urls = Object.fromEntries(signedPhotos.filter((p) => p.images[0]).map((p) => [p.date, p.images[0].thumb]));
    return res.json({ book: { ...brief(row), data: { ...data, posts, photo_urls } } });
  } catch (err) {
    return fail(res, 'get', err, '讀取這本書失敗');
  }
}

async function editable(req, res) {
  const { ym } = req.params;
  if (!B.isKey(ym)) { res.status(400).json({ error: '月份格式不正確' }); return null; }
  const row = await rowOf(req.user.id, ym);
  if (!row) { res.status(404).json({ error: '找不到這本書' }); return null; }
  if (row.status !== 'draft' || new Date() >= B.deadlineOf(ym)) { res.status(409).json({ error: '這本書已經定稿，不能再修改', code: 'BOOK_FINAL' }); return null; }
  return row;
}

// PATCH /books/:ym { message }:草稿才能改(2026-11-27 起不用挑封面,書背依月份固定)
async function update(req, res) {
  try {
    const row = await editable(req, res);
    if (!row) return undefined;
    const patch = {};
    if (req.body.message !== undefined) {
      const m = String(req.body.message || '').replace(/\r\n/g, '\n').trim();
      const max = B.messageMax(row.ym);
      if ([...m].length > max) return res.status(400).json({ error: `最多 ${max} 個字` });
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

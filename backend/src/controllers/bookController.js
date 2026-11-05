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

// 書櫃樣式與容量(與前端 lib/bookshelf.js 的 shelfCapacity 一致:樹屋 21、單櫃 16、高櫃 24)
// 使用者一次只能選一個書櫃,放滿了才能選下一個;選過的依序存在 yy_users.shelf_styles
const SHELF_CAPS = { 1: 21, 2: 16, 3: 24 };
const capOf = (styles) => styles.reduce((n, s) => n + (SHELF_CAPS[s] || 0), 0);

async function shelfStyles(uid) {
  const { data, error } = await supabase.from('yy_users').select('shelf_styles').eq('id', uid).single();
  if (error) throw error;
  return (data.shelf_styles || []).map(Number);
}

// GET /books:書櫃上的書(新的在後)+已選的書櫃
async function list(req, res) {
  try {
    await B.ensureBooks(req.user.id);
    const { data, error } = await supabase.from('yy_monthly_books').select('ym, status, cover, message, finalized_at')
      .eq('user_id', req.user.id).order('ym');
    if (error) throw error;
    const shelves = await shelfStyles(req.user.id);
    return res.json({ books: (data || []).map(brief), shelves });
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
    // 日常時光的照片:換成暫時網址(縮圖);照片已刪掉的那天就顯示心情
    const photoDays = Object.entries(data.photos || {});
    const signedPhotos = photoDays.length ? await signPosts(photoDays.map(([date, key]) => ({ date, images: [key] }))) : [];
    const photo_urls = Object.fromEntries(signedPhotos.filter((p) => p.images[0]).map((p) => [p.date, p.images[0].thumb]));
    return res.json({ book: { ...brief(row), cover: row.cover || null, default_cover: B.defaultCover(ym), data: { ...data, posts, photo_urls } } });
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

// POST /books/shelves { style }:選書櫃。還沒選過,或目前的書櫃都放滿了,才能選下一個
async function pickShelf(req, res) {
  try {
    const style = Number(req.body.style);
    if (!SHELF_CAPS[style]) return res.status(400).json({ error: '書櫃不正確' });
    const styles = await shelfStyles(req.user.id);
    const { count, error: cErr } = await supabase.from('yy_monthly_books').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
    if (cErr) throw cErr;
    if (styles.length && (count || 0) < capOf(styles)) {
      return res.status(409).json({ error: '目前的書櫃還沒放滿，放滿後才能選下一個', code: 'SHELF_NOT_FULL' });
    }
    const next = [...styles, style];
    const { error } = await supabase.from('yy_users').update({ shelf_styles: next }).eq('id', req.user.id);
    if (error) throw error;
    return res.json({ shelves: next });
  } catch (err) {
    return fail(res, 'pickShelf', err, '選擇書櫃失敗');
  }
}

module.exports = { list, get, update, finalize, pickShelf };

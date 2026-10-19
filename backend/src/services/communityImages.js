const crypto = require('crypto');
const supabase = require('../config/supabase');

// 社群文章照片:前端先壓縮(WebP,不支援時用 JPEG)並產生縮圖,後端存到私人 bucket,
// 讀取時發「有時效的網址」,私人文章的照片不會被外人直接打開。
// 檔名:<user_id>/<uuid>.<ext>(原圖)與 <user_id>/<uuid>_t.<ext>(縮圖)
const BUCKET = 'yy-community';
const MAX_PER_POST = 3;
const MAX_FULL = 1.5 * 1024 * 1024;
const MAX_THUMB = 300 * 1024;
const URL_TTL = 6 * 60 * 60; // 6 小時
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_FULL });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

const thumbKey = (key) => key.replace(/\.(webp|jpg)$/, '_t.$1');
const keyPattern = (userId) => new RegExp(`^${userId}/[0-9a-f-]{36}\\.(webp|jpg)$`);

function parseDataUrl(s) {
  const m = /^data:(image\/(?:webp|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) return null;
  return { type: m[1], buf: Buffer.from(m[2], 'base64') };
}

async function uploadImage(userId, fullDataUrl, thumbDataUrl) {
  const full = parseDataUrl(fullDataUrl);
  const thumb = parseDataUrl(thumbDataUrl);
  if (!full || !thumb || full.type !== thumb.type) throw Object.assign(new Error('照片格式不正確'), { status: 400 });
  if (full.buf.length > MAX_FULL || thumb.buf.length > MAX_THUMB) throw Object.assign(new Error('照片太大'), { status: 400 });
  await ensureBucket();
  const key = `${userId}/${crypto.randomUUID()}.${TYPES[full.type]}`;
  const opts = { contentType: full.type, upsert: false };
  const { error: e1 } = await supabase.storage.from(BUCKET).upload(key, full.buf, opts);
  if (e1) throw e1;
  const { error: e2 } = await supabase.storage.from(BUCKET).upload(thumbKey(key), thumb.buf, opts);
  if (e2) throw e2;
  return key;
}

// 驗證文章要用的照片:只能是自己上傳的,最多 3 張
function validKeys(userId, images) {
  if (images === undefined) return undefined;
  if (!Array.isArray(images) || images.length > MAX_PER_POST) return null;
  const re = keyPattern(userId);
  const keys = [...new Set(images.map(String))];
  return keys.every((k) => re.test(k)) ? keys : null;
}

async function removeImages(keys) {
  if (!keys?.length) return;
  const paths = keys.flatMap((k) => [k, thumbKey(k)]);
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.error('[communityImages] remove failed', error.message);
}

// 刪除帳號時清掉這位使用者的所有照片
async function removeUserFolder(userId) {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
    if (data?.length) await supabase.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
  } catch (err) {
    console.error('[communityImages] remove folder failed', err.message);
  }
}

// 幫一批文章換上照片網址:images = [{ key, url, thumb }]
async function signPosts(posts) {
  const keys = [...new Set(posts.flatMap((p) => (Array.isArray(p.images) ? p.images : [])))];
  if (keys.length === 0) return posts.map((p) => ({ ...p, images: [] }));
  const paths = keys.flatMap((k) => [k, thumbKey(k)]);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, URL_TTL);
  if (error) console.error('[communityImages] sign failed', error.message);
  const url = Object.fromEntries((data || []).map((d) => [d.path, d.signedUrl]));
  return posts.map((p) => ({
    ...p,
    images: (Array.isArray(p.images) ? p.images : []).filter((k) => url[k]).map((k) => ({ key: k, url: url[k], thumb: url[thumbKey(k)] || url[k] })),
  }));
}

module.exports = { uploadImage, validKeys, removeImages, removeUserFolder, signPosts, MAX_PER_POST, BUCKET };

const crypto = require('crypto');
const supabase = require('../config/supabase');

// 匯款回報的轉帳截圖:前端先壓縮,後端存到私人 bucket,只有管理員看得到(有時效的網址)
// 檔名:<user_id>/<uuid>.<ext>
const BUCKET = 'yy-payment-proofs';
const MAX_SIZE = 1.5 * 1024 * 1024;
const URL_TTL = 60 * 60; // 1 小時
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_SIZE });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

function parseDataUrl(s) {
  const m = /^data:(image\/(?:webp|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) return null;
  return { type: m[1], buf: Buffer.from(m[2], 'base64') };
}

async function uploadProof(userId, dataUrl) {
  const img = parseDataUrl(dataUrl);
  if (!img) throw Object.assign(new Error('照片格式不正確'), { status: 400 });
  if (img.buf.length > MAX_SIZE) throw Object.assign(new Error('照片太大'), { status: 400 });
  await ensureBucket();
  const key = `${userId}/${crypto.randomUUID()}.${TYPES[img.type]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, img.buf, { contentType: img.type, upsert: false });
  if (error) throw error;
  return key;
}

const validKey = (userId, key) => new RegExp(`^${userId}/[0-9a-f-]{36}\\.(webp|jpg)$`).test(String(key || ''));

async function signedUrl(key) {
  if (!key) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(key, URL_TTL);
  return data?.signedUrl || null;
}

async function removeProof(key) {
  if (!key) return;
  await supabase.storage.from(BUCKET).remove([key]).catch(() => {});
}

module.exports = { BUCKET, uploadProof, validKey, signedUrl, removeProof };

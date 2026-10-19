// 社群照片:上傳前在手機/瀏覽器上先縮小並壓縮
// 原圖最長邊 1600px、縮圖 480px;優先用 WebP,瀏覽器不支援(例如 Safari)就改用 JPEG
const FULL = 1600;
const THUMB = 480;
const MAX_BYTES = 1.4 * 1024 * 1024;

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function draw(src, max) {
  const w = src.width;
  const h = src.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // 透明背景(PNG)改成白底,JPEG 才不會變黑
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const bytesOf = (dataUrl) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

function encode(canvas, type, quality) {
  return canvas.toDataURL(type, quality);
}

export async function compressImage(file) {
  const src = await decode(file);
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const webp = encode(probe, 'image/webp', 0.8).startsWith('data:image/webp');
  const type = webp ? 'image/webp' : 'image/jpeg';
  let image = '';
  for (const [max, q] of [[FULL, 0.8], [FULL, 0.65], [1280, 0.6], [1024, 0.55]]) {
    image = encode(draw(src, max), type, q);
    if (bytesOf(image) <= MAX_BYTES) break;
  }
  const thumb = encode(draw(src, THUMB), type, 0.7);
  if (typeof src.close === 'function') src.close();
  return { image, thumb };
}

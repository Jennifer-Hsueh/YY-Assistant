import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { compressImage } from '../lib/imageCompress';

export const MAX_IMAGES = 3;

// 文章裡的照片:縮圖排一列,點了放大看(可左右切換)
export function PostImages({ images }) {
  const [open, setOpen] = useState(null);
  if (!images?.length) return null;
  const cols = images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <>
      <div className={`mt-2 grid gap-1.5 ${cols}`}>
        {images.map((img, i) => (
          <button key={img.key} type="button" onClick={() => setOpen(i)} className="overflow-hidden rounded-lg bg-muted">
            <img
              src={img.thumb}
              alt=""
              loading="lazy"
              className={`w-full object-cover ${images.length === 1 ? 'max-h-80' : 'aspect-square'}`}
            />
          </button>
        ))}
      </div>
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ images, index, onIndex, onClose }) {
  const startX = useRef(null);
  const go = (d) => onIndex((index + d + images.length) % images.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (startX.current ?? 0);
        if (Math.abs(dx) > 50 && images.length > 1) go(dx < 0 ? 1 : -1);
      }}
    >
      <img src={images[index].url} alt="" className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
      <button type="button" aria-label="close" onClick={onClose} className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] rounded-full bg-black/50 p-2 text-white"><X className="h-5 w-5" /></button>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="prev" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-2 rounded-full bg-black/50 p-2 text-white"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="next" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-2 rounded-full bg-black/50 p-2 text-white"><ChevronRight className="h-5 w-5" /></button>
          <span className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] text-xs text-white/80">{index + 1} / {images.length}</span>
        </>
      )}
    </div>
  );
}

// 發文 / 編輯時選照片:選了就壓縮並上傳,value = [{ key, url, thumb }]
export function ImagePicker({ value, onChange, onBusy, t }) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const room = MAX_IMAGES - value.length - uploading;

  async function pick(e) {
    const files = [...(e.target.files || [])].slice(0, Math.max(0, room));
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setUploading((n) => n + files.length);
    onBusy?.(true);
    const added = [];
    for (const file of files) {
      try {
        const { image, thumb } = await compressImage(file);
        const res = await api.uploadCommunityImage(image, thumb);
        added.push(res.image);
      } catch (err) {
        console.error(err);
        setError(err.status ? t('cm_photo_failed') : t('cm_photo_unreadable'));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onBusy?.(false);
    if (added.length) onChange((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((img) => (
          <div key={img.key} className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
            <img src={img.thumb} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="remove"
              onClick={() => onChange((prev) => prev.filter((x) => x.key !== img.key))}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground hover:bg-muted/60"
          >
            <ImagePlus className="h-4 w-4" />
            {value.length + uploading}/{MAX_IMAGES}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

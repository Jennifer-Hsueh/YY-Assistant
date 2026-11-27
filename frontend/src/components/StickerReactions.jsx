import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SmilePlus } from 'lucide-react';

// 晴空與雨天的回應：12 張小河狸貼圖（public/stickers/<key>.webp）
// 按一下 = 送出；長按 = 放大看看（放開就收起來，不會送出）
export const STICKERS = ['like', 'surprise', 'confused', 'angry', 'cry', 'hug', 'happy', 'touched', 'excited', 'cheer', 'no', 'thanks'];
export const stickerSrc = (key) => `/stickers/${key}.webp`;
const LONG_PRESS_MS = 420;

// 一張可以「點一下送出、長按放大」的貼圖按鈕
function Sticker({ k, label, active, size = 'h-11 w-11', onSend, onPreview, children, className = '' }) {
  const timer = useRef(null);
  const longPressed = useRef(false);
  const start = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    longPressed.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { longPressed.current = true; onPreview(k); }, LONG_PRESS_MS);
  };
  const end = () => {
    clearTimeout(timer.current);
    if (longPressed.current) onPreview(null);
  };
  const click = (e) => {
    if (longPressed.current) { e.preventDefault(); longPressed.current = false; return; }
    onSend(k);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      onClick={click}
      className={`select-none [-webkit-touch-callout:none] ${className}`}
    >
      <img src={stickerSrc(k)} alt="" draggable="false" className={`${size} pointer-events-none`} />
      {children}
    </button>
  );
}

// 放大預覽（長按時）
function Preview({ k, label }) {
  if (!k) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/25">
      <div className="flex flex-col items-center rounded-3xl bg-background/95 px-8 pb-5 pt-6 shadow-2xl">
        <img src={stickerSrc(k)} alt="" className="h-44 w-44" />
        <span className="mt-1 text-sm font-medium">{label}</span>
      </div>
    </div>,
    document.body
  );
}

// 文章下方：已收到的回應（有數字的才顯示）＋「回應」按鈕打開 12 張貼圖
export default function StickerReactions({ reactions = {}, mine, onReact, t }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const label = (k) => t(`cm_r_${k}`);
  const send = (k) => { setOpen(false); onReact(k); };
  const got = STICKERS.filter((k) => reactions[k] > 0);

  return (
    <>
      {got.map((k) => (
        <Sticker
          key={k}
          k={k}
          label={label(k)}
          active={mine === k}
          size="h-6 w-6"
          onSend={send}
          onPreview={setPreview}
          className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-1 pr-2.5 text-xs transition-colors ${mine === k ? 'border-foreground bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60'}`}
        >
          <span className="tabular-nums">{reactions[k]}</span>
        </Sticker>
      ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${open ? 'border-foreground bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60'}`}
      >
        {mine ? <img src={stickerSrc(mine)} alt="" className="h-5 w-5" /> : <SmilePlus className="h-3.5 w-3.5" />}
        {t('cm_react')}
      </button>
      {open && (
        <div className="basis-full">
          <div className="mt-1 grid grid-cols-6 gap-1 rounded-xl border border-border bg-card p-2">
            {STICKERS.map((k) => (
              <Sticker
                key={k}
                k={k}
                label={label(k)}
                active={mine === k}
                onSend={send}
                onPreview={setPreview}
                className={`flex flex-col items-center rounded-lg p-1 transition-colors hover:bg-muted/60 ${mine === k ? 'bg-muted ring-1 ring-foreground/40' : ''}`}
              >
                <span className="mt-0.5 text-[10.5px] leading-tight text-muted-foreground">{label(k)}</span>
              </Sticker>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t('cm_react_hint')}</p>
        </div>
      )}
      <Preview k={preview} label={preview ? label(preview) : ''} />
    </>
  );
}

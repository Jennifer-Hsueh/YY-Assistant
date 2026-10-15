import { Check } from 'lucide-react';

// 墨箋絮語的打勾圓圈(首頁卡片與筆記頁共用)
export default function NoteCheck({ done, onToggle, label, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-[var(--module-notes)] bg-[var(--module-notes)] text-white' : 'border-[var(--module-notes)]/60 hover:bg-[var(--module-notes)]/10'}`}
    >
      {done && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

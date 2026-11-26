import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, Delete } from 'lucide-react';
import { Input } from './ui/input';
import { useLanguage } from '../context/LanguageContext';

// 金額欄＋計算機數字視窗
// 手機（觸控）：點到金額欄就跳出數字視窗，不跳手機鍵盤（inputMode none），可以直接算 120+85
// 電腦：照常用鍵盤打字，右邊的計算機圖示可以打開數字視窗（視窗打開時也能用實體鍵盤）

const OPS = ['+', '−', '×', '÷'];
const isOp = (c) => OPS.includes(c);

// 安全計算（不用 eval）：先乘除後加減
export function evaluate(expr) {
  const s = String(expr || '').replace(/\s/g, '');
  if (!s) return null;
  const tokens = s.match(/\d*\.?\d+|\d+\.|[+−×÷]/g);
  if (!tokens || tokens.join('') !== s) return NaN;
  const t = [...tokens];
  while (t.length && isOp(t.at(-1))) t.pop(); // 結尾的運算符號先忽略
  if (!t.length || isOp(t[0])) return NaN;
  const nums = [Number(t[0])];
  const ops = [];
  for (let i = 1; i < t.length; i += 2) {
    const op = t[i];
    const n = Number(t[i + 1]);
    if (!isOp(op) || Number.isNaN(n)) return NaN;
    if (op === '×') nums.push(nums.pop() * n);
    else if (op === '÷') { if (n === 0) return NaN; nums.push(nums.pop() / n); }
    else { ops.push(op); nums.push(n); }
  }
  let r = nums[0];
  ops.forEach((op, i) => { r = op === '+' ? r + nums[i + 1] : r - nums[i + 1]; });
  return Math.round(r * 100) / 100;
}

const coarsePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

function AmountPad({ initial, placeholder, onDone, onCancel }) {
  const { t } = useLanguage();
  const [expr, setExpr] = useState(initial ? String(initial) : '');
  const [error, setError] = useState('');
  const result = evaluate(expr);
  const hasOp = /[+−×÷]/.test(expr);

  const press = (k) => {
    setError('');
    setExpr((prev) => {
      if (k === 'C') return '';
      if (k === 'back') return prev.slice(0, -1);
      if (k === '=') { const r = evaluate(prev); return r === null || Number.isNaN(r) ? prev : String(r); }
      const last = prev.slice(-1);
      if (isOp(k)) {
        if (!prev) return k === '−' ? prev : prev;
        return isOp(last) ? prev.slice(0, -1) + k : prev + k;
      }
      if (k === '.') {
        const cur = prev.split(/[+−×÷]/).at(-1);
        if (cur.includes('.')) return prev;
        return prev + (cur === '' ? '0.' : '.');
      }
      const cur = prev.split(/[+−×÷]/).at(-1);
      if (cur.includes('.') && cur.split('.')[1].length >= 2) return prev; // 最多兩位小數
      if (cur === '0' && k !== '.') return prev.slice(0, -1) + k;
      if (prev.replace(/[^\d]/g, '').length >= 15) return prev;
      return prev + k;
    });
  };

  const done = () => {
    const r = evaluate(expr);
    if (r === null) { onDone(''); return; }
    if (Number.isNaN(r)) { setError(t('pad_invalid')); return; }
    if (r <= 0) { setError(t('pad_positive')); return; }
    onDone(String(r));
  };

  // 電腦的實體鍵盤也可以用
  const doneRef = useRef(done);
  doneRef.current = done;
  useEffect(() => {
    const onKey = (e) => {
      const map = { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷', '.': '.', Backspace: 'back', '=': '=' };
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
      else if (e.key === 'Enter') { e.preventDefault(); doneRef.current(); }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const key = (k, label, extra = '') => (
    <button
      type="button"
      key={k}
      onClick={() => press(k)}
      aria-label={k === 'back' ? t('pad_back') : undefined}
      className={`flex h-12 items-center justify-center rounded-lg border border-border text-lg font-medium transition-colors active:scale-[.97] ${extra}`}
    >
      {label}
    </button>
  );
  const digit = (d) => key(d, d, 'bg-card hover:bg-muted/60');
  const op = (o) => key(o, o, 'bg-muted/60 text-primary hover:bg-muted');

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-end"
      onClick={(e) => { e.stopPropagation(); done(); }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label={t('pad_title')}
        className="w-full max-w-sm rounded-t-2xl border border-border bg-background p-3 shadow-2xl md:mb-6 md:rounded-2xl"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 rounded-lg bg-muted/40 px-3 py-2 text-right">
          <div className="min-h-5 truncate text-xs text-muted-foreground">
            {hasOp && result !== null && !Number.isNaN(result) ? `= ${result.toLocaleString()}` : placeholder}
          </div>
          <div className="font-amount truncate text-3xl tabular-nums" aria-live="polite">{expr || '0'}</div>
        </div>
        {error && <p className="mb-2 text-center text-xs text-destructive">{error}</p>}
        <div className="grid grid-cols-4 gap-2">
          {key('C', 'C', 'bg-muted/60 text-muted-foreground hover:bg-muted')}
          {op('÷')}
          {op('×')}
          {key('back', <Delete className="h-5 w-5" />, 'bg-muted/60 text-muted-foreground hover:bg-muted')}
          {digit('7')}{digit('8')}{digit('9')}{op('−')}
          {digit('4')}{digit('5')}{digit('6')}{op('+')}
          {digit('1')}{digit('2')}{digit('3')}{key('=', '=', 'bg-muted/60 text-primary hover:bg-muted')}
          {key('0', '0', 'col-span-2 bg-card hover:bg-muted/60')}
          {digit('.')}
          <button type="button" onClick={done} className="h-12 rounded-lg bg-primary text-base font-medium text-primary-foreground active:scale-[.97]">
            {t('pad_done')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const AmountInput = forwardRef(function AmountInput({ value, onChange, placeholder, className = '', inputClassName = '', onFocus, ...props }, ref) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [touch] = useState(coarsePointer);
  const innerRef = useRef(null);
  const setRefs = (el) => {
    innerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const show = () => setOpen(true);
  const close = () => {
    setOpen(false);
    innerRef.current?.blur();
  };

  return (
    <div className={`relative ${className}`}>
      <Input
        ref={setRefs}
        type="text"
        inputMode={touch ? 'none' : 'decimal'}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        onFocus={(e) => { if (touch) show(); onFocus?.(e); }}
        onClick={() => { if (touch) show(); }}
        className={`${touch ? 'w-full cursor-pointer' : 'w-full pr-9'} ${inputClassName}`}
        {...props}
      />
      {!touch && (
        <button
          type="button"
          onClick={show}
          aria-label={t('pad_title')}
          title={t('pad_title')}
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Calculator className="h-4 w-4" />
        </button>
      )}
      {open && (
        <AmountPad
          initial={value}
          placeholder={placeholder}
          onDone={(v) => { onChange(v); close(); }}
          onCancel={close}
        />
      )}
    </div>
  );
});

export default AmountInput;

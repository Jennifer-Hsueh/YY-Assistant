import { useEffect, useState } from 'react';
import { Input } from './ui/input';

// 直接輸入數字的日期欄位:8 碼 20200101 → 2020/01/01;noYear 時 4 碼 0101 → 01/01
// 對外的值:完整日期 'YYYY-MM-DD'(noYear 用 2000 年代表),還沒打完或不合法時是 ''
const fmt = (digits, noYear) => {
  const d = digits.slice(0, noYear ? 4 : 8);
  if (noYear) return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  if (d.length > 6) return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}`;
  if (d.length > 4) return `${d.slice(0, 4)}/${d.slice(4)}`;
  return d;
};
function toValue(digits, noYear) {
  const d = noYear ? `2000${digits.slice(0, 4)}` : digits.slice(0, 8);
  if (d.length !== 8) return '';
  const y = +d.slice(0, 4); const m = +d.slice(4, 6); const day = +d.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, day));
  if (y < 1900 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== day) return '';
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
const fromValue = (v, noYear) => (v ? (noYear ? v.slice(5).replace('-', '') : v.replace(/-/g, '')) : '');

export default function DigitDateInput({ value, onChange, noYear = false, ...props }) {
  const [digits, setDigits] = useState(fromValue(value, noYear));
  // 外部改了值(例如換編輯對象)才同步;打字到一半時外部值是 '',不要清掉
  useEffect(() => {
    setDigits((cur) => (value === toValue(cur, noYear) ? cur : fromValue(value, noYear)));
  }, [value, noYear]);
  const full = digits.length === (noYear ? 4 : 8);
  const bad = full && !toValue(digits, noYear);
  return (
    <Input
      {...props}
      inputMode="numeric"
      placeholder={noYear ? 'mm/dd' : 'yyyy/mm/dd'}
      value={fmt(digits, noYear)}
      className={`font-amount ${bad ? 'border-destructive' : ''} ${props.className || ''}`}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '').slice(0, noYear ? 4 : 8);
        setDigits(d);
        onChange(toValue(d, noYear));
      }}
    />
  );
}

import { useEffect, useRef, useState } from 'react';
import { Input } from './ui/input';

export default function DateInputSegmented({ value, onChange, required }) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const yearRef = useRef(null);
  const monthRef = useRef(null);
  const dayRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setYear('');
      setMonth('');
      setDay('');
    }
  }, [value]);

  function emit(y, m, d) {
    if (y.length === 4 && m.length === 2 && d.length === 2) {
      onChange(`${y}-${m}-${d}`);
    }
  }

  function handleYear(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(v);
    emit(v, month, day);
    if (v.length === 4) monthRef.current?.focus();
  }

  function handleMonth(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMonth(v);
    emit(year, v, day);
    if (v.length === 2) dayRef.current?.focus();
  }

  function handleDay(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDay(v);
    emit(year, month, v);
  }

  function handleKeyDown(e, segment) {
    if (e.key !== 'Backspace') return;
    if (segment === 'month' && !month) yearRef.current?.focus();
    if (segment === 'day' && !day) monthRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-1">
      <Input ref={yearRef} type="text" inputMode="numeric" placeholder="西元年" value={year} onChange={handleYear} required={required} className="w-20 text-center" maxLength={4} />
      <span className="text-muted-foreground">/</span>
      <Input ref={monthRef} type="text" inputMode="numeric" placeholder="月" value={month} onChange={handleMonth} onKeyDown={(e) => handleKeyDown(e, 'month')} required={required} className="w-14 text-center" maxLength={2} />
      <span className="text-muted-foreground">/</span>
      <Input ref={dayRef} type="text" inputMode="numeric" placeholder="日" value={day} onChange={handleDay} onKeyDown={(e) => handleKeyDown(e, 'day')} required={required} className="w-14 text-center" maxLength={2} />
    </div>
  );
}

import { useState } from 'react';
import { Cake } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const TEXT = {
  zh: { title: '生日', month: '月', day: '日', none: '未設定', share: '讓好友知道我的生日', remind: '好友生日提醒', on: '開啟', off: '關閉', hint: '只記月日，不記年份', saved: '已儲存' },
  en: { title: 'Birthday', month: 'Month', day: 'Day', none: 'Not set', share: 'Let friends see my birthday', remind: "Friends' birthday reminders", on: 'On', off: 'Off', hint: 'Month and day only, no year', saved: 'Saved' },
};
const pad = (n) => String(n).padStart(2, '0');

// 設定頁:生日(月日)、公開給好友、好友生日提醒
export default function BirthdayCard({ profile, onSaved }) {
  const { language } = useLanguage();
  const T = TEXT[language] || TEXT.zh;
  const [m, d] = (profile?.birthday_md || '-').split('-');
  const [month, setMonth] = useState(m || '');
  const [day, setDay] = useState(d || '');
  const [msg, setMsg] = useState('');

  async function save(patch) {
    setMsg('');
    try { const { profile: p } = await api.updateProfile(patch); onSaved?.(p); setMsg(T.saved); setTimeout(() => setMsg(''), 1500); } catch (e) { setMsg(e.message); }
  }
  function pick(nm, nd) {
    setMonth(nm); setDay(nd);
    if (!nm && !nd) save({ birthday_md: null });
    else if (nm && nd) save({ birthday_md: `${nm}-${nd}` });
  }
  const days = month === '02' ? 29 : ['04', '06', '09', '11'].includes(month) ? 30 : 31;
  const sel = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
  const Toggle = ({ value, onClick }) => <Button size="sm" variant={value ? 'default' : 'outline'} onClick={onClick}>{value ? T.on : T.off}</Button>;

  return (
    <Card className="mb-3">
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Cake className="h-4 w-4" />{T.title}</p>
        <div className="flex items-center gap-2">
          <select aria-label={T.month} className={sel} value={month} onChange={(e) => pick(e.target.value, day && Number(day) <= 31 ? day : '')}>
            <option value="">{T.month}</option>
            {Array.from({ length: 12 }, (_, i) => pad(i + 1)).map((v) => <option key={v} value={v}>{Number(v)}</option>)}
          </select>
          <select aria-label={T.day} className={sel} value={day} onChange={(e) => pick(month, e.target.value)}>
            <option value="">{T.day}</option>
            {Array.from({ length: days }, (_, i) => pad(i + 1)).map((v) => <option key={v} value={v}>{Number(v)}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{T.hint}</span>
          {msg && <span className="ml-auto text-xs text-muted-foreground">{msg}</span>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{T.share}</span>
          <Toggle value={profile?.birthday_visible !== false} onClick={() => save({ birthday_visible: profile?.birthday_visible === false })} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{T.remind}</span>
          <Toggle value={profile?.notify_birthdays !== false} onClick={() => save({ notify_birthdays: profile?.notify_birthdays === false })} />
        </div>
      </CardContent>
    </Card>
  );
}

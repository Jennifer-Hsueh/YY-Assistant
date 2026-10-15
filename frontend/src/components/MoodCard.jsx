import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun } from 'lucide-react';
import { api } from '../lib/api';
import { ymd } from '../lib/budget';
import { MOODS } from '../lib/moods';
import { Card, CardContent } from './ui/card';

// 設定頁的「本日心情」:選一種天氣,再點一次取消;首頁角色左上角會顯示
export default function MoodCard({ t }) {
  const todayKey = ymd(new Date());
  const [mood, setMood] = useState(null);

  useEffect(() => {
    api.listMoods({ from: todayKey, to: todayKey })
      .then(({ moods }) => setMood(moods[0]?.mood || null))
      .catch(() => {});
  }, []);

  async function pick(key) {
    const next = mood === key ? null : key;
    setMood(next);
    try {
      await api.setMood(todayKey, next);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <CloudSun className="h-4 w-4" />
          {t('home_mood')}
        </p>
        <div className="grid grid-cols-5 gap-1.5 md:grid-cols-9">
          {MOODS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-label={t(`mood_${m.key}`)}
              title={t(`mood_${m.key}`)}
              onClick={() => pick(m.key)}
              className={`rounded-xl border py-2 text-2xl leading-none transition-all ${mood === m.key ? 'scale-105 border-foreground bg-card shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              {m.emoji}
            </button>
          ))}
        </div>
        <Link to="/community" className="mt-3 inline-block text-xs text-muted-foreground underline">{t('home_mood_share')}</Link>
      </CardContent>
    </Card>
  );
}

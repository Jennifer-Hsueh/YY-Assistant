import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';

export default function Announcements() {
  const { t } = useLanguage();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { announcements } = await api.listAnnouncements();
        setAnnouncements(announcements);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <h1 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Megaphone className="h-5 w-5" style={{ color: 'var(--module-recurring)' }} />
        {t('nav_announcements')}
      </h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('ann_empty')}</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <p className="mb-1 text-xs text-muted-foreground">{a.published_at.slice(0, 10)}</p>
                <p className="mb-1 font-medium">{a.title}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

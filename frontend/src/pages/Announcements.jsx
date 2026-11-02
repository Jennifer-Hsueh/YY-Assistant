import { useEffect, useState } from 'react';
import { Megaphone, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import { markAnnouncementsSeen, refreshAnnStatus, useAnnStatus } from '../lib/annStatus';

export default function Announcements() {
  const { t } = useLanguage();
  const { friendRequests, friendAccepted } = useAnnStatus();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        await refreshAnnStatus(); // 先抓好友通知的數字(直接開這頁時也看得到)
        const { announcements } = await api.listAnnouncements();
        setAnnouncements(announcements);
        markAnnouncementsSeen(); // 打開公告頁就算看過:鈴鐺紅點與重要橫幅一起消失
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10">
      <h1 className="page-title-row page-title mb-4 flex items-center gap-2 text-lg font-semibold">
        <Megaphone className="h-5 w-5 md:hidden" style={{ color: 'var(--module-recurring)' }} />
        {t('nav_announcements')}
      </h1>

      {/* 好友通知:點了到好友頁 */}
      {(friendRequests > 0 || friendAccepted > 0) && (
        <Link to="/community/friends" className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm hover:bg-muted/50">
          <UserPlus className="h-5 w-5 shrink-0" style={{ color: 'var(--expense)' }} />
          <span className="min-w-0 flex-1 text-sm">
            {[friendRequests > 0 && t('ann_friend_requests').replace('{n}', friendRequests), friendAccepted > 0 && t('ann_friend_accepted').replace('{n}', friendAccepted)].filter(Boolean).join('；')}
          </span>
          <span className="text-xs text-muted-foreground">{t('ann_go_friends')}</span>
        </Link>
      )}

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
                <p className="mb-1 flex items-center gap-2 font-medium">
                  {a.is_important && (
                    <span className="shrink-0 rounded bg-[#C1666B] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">{t('ann_important')}</span>
                  )}
                  {a.title}
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

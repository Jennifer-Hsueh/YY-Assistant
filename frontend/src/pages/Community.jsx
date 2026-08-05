import { Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent } from '../components/ui/card';

export default function Community() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <h1 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5" style={{ color: 'var(--module-accounts)' }} />
        {t('nav_community')}
      </h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm text-muted-foreground">{t('community_placeholder')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

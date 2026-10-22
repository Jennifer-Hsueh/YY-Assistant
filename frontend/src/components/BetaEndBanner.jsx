import { Link } from 'react-router-dom';
import { useBeta } from '../lib/useBeta';
import { useLanguage } from '../context/LanguageContext';

// 已決定測試結束日:每頁上方提醒使用者先備份
export default function BetaEndBanner() {
  const beta = useBeta();
  const { language } = useLanguage();
  if (!beta?.active || !beta.ends_at) return null;
  const d = beta.ends_at.replace(/-/g, '/');
  return (
    <div className="mx-4 mt-3 rounded-lg px-3 py-2 text-sm md:mx-8" style={{ background: 'color-mix(in srgb, var(--primary) 14%, var(--card))', color: 'var(--foreground)' }}>
      {language === 'en'
        ? <>The beta ends on {d}. Please download a backup in <Link to="/settings" className="underline">Settings</Link> before then.</>
        : <>測試版將於 {d} 結束，請在結束前到<Link to="/settings" className="mx-0.5 underline">設定</Link>下載備份。</>}
    </div>
  );
}

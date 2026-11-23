import { Languages } from 'lucide-react';
import { useLanguage, LANGS, HTML_LANG } from '../context/LanguageContext';

// 語言選單(中文／English／日本語):外觀是小地球＋目前語言,點了用手機或瀏覽器原生的選單挑
const SHORT = { zh: '中文', en: 'EN', ja: '日本語' };

export default function LanguageMenu({ className = '', style, showIcon = true }) {
  const { language, setLanguage } = useLanguage();
  return (
    <label className={`relative inline-flex cursor-pointer items-center gap-1 whitespace-nowrap ${className}`} style={style}>
      {showIcon && <Languages className="h-3.5 w-3.5" aria-hidden="true" />}
      <span aria-hidden="true">{SHORT[language] || SHORT.zh}</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label="Language / 語言 / 言語"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {LANGS.map(([k, name]) => <option key={k} value={k} lang={HTML_LANG[k]}>{name}</option>)}
      </select>
    </label>
  );
}

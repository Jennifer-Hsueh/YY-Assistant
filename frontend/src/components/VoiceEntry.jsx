import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Wand2 } from 'lucide-react';
import { Input } from './ui/input';
import { useLanguage } from '../context/LanguageContext';

// 一句話記帳(快速新增的「記一筆」上方)
// 瀏覽器支援語音辨識(Chrome、Edge、Safari)時:按麥克風直接說,說完自動帶入下面的欄位
// 不支援時(例如 App 內):用手機鍵盤上的麥克風輸入文字,再按「帶入」
// 帶入後不會直接存,使用者在下面的表單確認、修改後才按「新增」
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const LANG_TAG = { zh: 'zh-TW', en: 'en-US', ja: 'ja-JP' };

export default function VoiceEntry({ onParse }) {
  const { t, language } = useLanguage();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [msg, setMsg] = useState('');
  const recRef = useRef(null);
  const inputRef = useRef(null);
  const finalRef = useRef('');

  useEffect(() => () => recRef.current?.abort?.(), []);

  const apply = (value) => {
    const v = (value ?? text).trim();
    if (!v) return;
    onParse(v);
    setMsg(t('qa_voice_filled'));
  };

  const start = () => {
    setMsg('');
    if (!SR) {
      // 沒有語音辨識:請使用者用鍵盤的麥克風
      inputRef.current?.focus();
      setMsg(t('qa_voice_kb_hint'));
      return;
    }
    try {
      const rec = new SR();
      rec.lang = LANG_TAG[language] || 'zh-TW';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      finalRef.current = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += r[0].transcript;
          else interim += r[0].transcript;
        }
        setText((finalRef.current + interim).trim());
      };
      rec.onerror = (e) => {
        setListening(false);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMsg(t('qa_voice_denied'));
        else if (e.error !== 'aborted' && e.error !== 'no-speech') setMsg(t('qa_voice_kb_hint'));
      };
      rec.onend = () => {
        setListening(false);
        if (finalRef.current.trim()) apply(finalRef.current);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      inputRef.current?.focus();
      setMsg(t('qa_voice_kb_hint'));
    }
  };

  const stop = () => recRef.current?.stop?.();

  return (
    <div className="rounded-lg border border-dashed border-border p-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-label={listening ? t('qa_voice_stop') : t('qa_voice_listen')}
          title={listening ? t('qa_voice_stop') : t('qa_voice_listen')}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${listening ? 'animate-pulse border-destructive bg-destructive text-destructive-foreground' : 'border-border text-primary hover:bg-muted'}`}
        >
          {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          placeholder={t('qa_voice_ph')}
          className="min-w-0 flex-1"
          enterKeyHint="done"
        />
        <button
          type="button"
          onClick={() => apply()}
          disabled={!text.trim()}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 text-sm hover:bg-muted disabled:opacity-40"
        >
          <Wand2 className="h-4 w-4" />{t('qa_voice_fill')}
        </button>
      </div>
      {(msg || listening) && <p className="mt-1.5 text-xs text-muted-foreground">{listening ? t('qa_voice_listening') : msg}</p>}
    </div>
  );
}

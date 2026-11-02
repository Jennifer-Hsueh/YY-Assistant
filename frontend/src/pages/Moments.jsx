import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { usePlan } from '../context/PlanContext';
import { askUpgrade } from '../components/PlanNotice';
import { compressImage } from '../lib/imageCompress';
import { ymd } from '../lib/recurrence';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import MonthSwitcher from '../components/MonthSwitcher';

const CAPTION_MAX = 60;
const len = (s) => [...s].length;

// 日常時光:貼上每天的生活照片,只有自己看得到;同一天有好幾張就隨機挑一張當代表,月刊的心情頁也會放上照片
export default function Moments() {
  const { t, language } = useLanguage();
  const { can } = usePlan();
  const allowed = can('moments');
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const ym = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const [items, setItems] = useState(null);
  const [date, setDate] = useState(ymd(new Date()));
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(null); // { done, total }
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState(null); // { date, idx }
  const [confirmDel, setConfirmDel] = useState(false);
  const [seed, setSeed] = useState(() => Math.random());
  const fileRef = useRef(null);

  async function load() {
    try {
      const { moments } = await api.listMoments(ym);
      setItems(moments);
    } catch (err) {
      console.error(err);
      setItems([]);
    }
  }
  useEffect(() => { setItems(null); load(); }, [ym]);

  // 依日期分組,每天隨機挑一張當代表(每次打開頁面重新挑)
  const days = useMemo(() => {
    const by = {};
    (items || []).forEach((m) => { (by[m.date] ||= []).push(m); });
    return Object.entries(by).sort((a, b) => b[0].localeCompare(a[0])).map(([d, list]) => {
      const n = [...d].reduce((s, ch) => s + ch.charCodeAt(0), 0);
      return { date: d, list, pick: list[Math.floor(((seed * 1000 + n) % 1) * list.length) % list.length] };
    });
  }, [items, seed]);

  function pickFiles() {
    if (!allowed) { askUpgrade('moments'); return; }
    fileRef.current?.click();
  }

  async function upload(e) {
    const files = [...(e.target.files || [])].slice(0, 9);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setBusy({ done: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i += 1) {
        const { image, thumb } = await compressImage(files[i]);
        await api.createMoment({ date, caption: caption.trim(), image, thumb });
        setBusy({ done: i + 1, total: files.length });
      }
      setCaption('');
      if (date.slice(0, 7) !== ym) {
        const [y, m] = date.split('-').map(Number);
        setMonth(new Date(y, m - 1, 1));
      } else {
        await load();
      }
      setSeed(Math.random());
    } catch (err) {
      setError(err?.message || t('mo_upload_failed'));
      load();
    } finally {
      setBusy(null);
    }
  }

  const dayList = viewer ? days.find((d) => d.date === viewer.date)?.list || [] : [];
  const cur = dayList[viewer?.idx || 0];
  async function removeCur() {
    if (!cur) return;
    setConfirmDel(false);
    try {
      await api.deleteMoment(cur.id);
      setItems((prev) => prev.filter((m) => m.id !== cur.id));
      if (dayList.length <= 1) setViewer(null);
      else setViewer({ date: viewer.date, idx: Math.max(0, viewer.idx - 1) });
    } catch (err) {
      setError(err?.message || t('mo_delete_failed'));
    }
  }

  const dayLabel = (d) => {
    const dt = new Date(`${d}T00:00:00`);
    return `${dt.getMonth() + 1}/${dt.getDate()}（${t('cal_weekdays')[dt.getDay()]}）`;
  };
  const today = ymd(new Date());

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10">
      <h1 className="page-title-row page-title mb-1 text-lg font-semibold">{t('nav_moments')}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t('mo_intro')}</p>

      <div className="md:grid md:grid-cols-[340px_minmax(0,1fr)] md:items-start md:gap-6">
        <Card className="mb-4 md:sticky md:top-6">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">{t('mo_add_title')}</p>
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
            <div className="relative">
              <Input value={caption} onChange={(e) => setCaption([...e.target.value].slice(0, CAPTION_MAX).join(''))} placeholder={t('mo_caption_ph')} className="pr-14" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{len(caption)}/{CAPTION_MAX}</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
            <Button type="button" className="w-full" onClick={pickFiles} disabled={!!busy}>
              <ImagePlus className="mr-1.5 h-4 w-4" />
              {busy ? t('mo_uploading').replace('{d}', busy.done).replace('{n}', busy.total) : t('mo_pick')}
            </Button>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <p className="text-xs text-muted-foreground">{allowed ? t('mo_hint') : t('mo_full_only')}</p>
          </CardContent>
        </Card>

        <div>
          <MonthSwitcher month={month} onChange={setMonth} t={t} className="mb-4" />
          {items === null ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : days.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <img src="/reactions/hug.webp" alt="" className="h-24 w-24" />
              <p className="mt-3 text-sm text-muted-foreground">{t('mo_empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {days.map((d, i) => (
                <button key={d.date} type="button" onClick={() => setViewer({ date: d.date, idx: d.list.indexOf(d.pick) })} className="moment-polaroid w-full min-w-0 text-left" style={{ transform: `rotate(${i % 3 === 0 ? -1.5 : i % 3 === 1 ? 1.2 : -0.6}deg)` }}>
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {d.pick.thumb && <img src={d.pick.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    {d.list.length > 1 && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 text-[11px] text-white">+{d.list.length - 1}</span>}
                  </div>
                  <p className="mt-2 font-amount text-xs text-muted-foreground">{dayLabel(d.date)}</p>
                  {d.pick.caption && <p className="mt-0.5 line-clamp-2 text-sm leading-snug">{d.pick.caption}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewer && cur && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => { setViewer(null); setConfirmDel(false); }}>
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label="close" onClick={() => { setViewer(null); setConfirmDel(false); }} className="absolute -top-10 right-0 text-white/80"><X className="h-6 w-6" /></button>
            <img src={cur.url || cur.thumb} alt="" className="max-h-[70vh] w-full rounded-md object-contain" />
            <div className="mt-3 flex items-start gap-3 text-white">
              <div className="min-w-0 flex-1">
                <p className="font-amount text-sm opacity-80">{dayLabel(cur.date)}{dayList.length > 1 ? `　${(viewer.idx || 0) + 1}/${dayList.length}` : ''}</p>
                {cur.caption && <p className="mt-1 text-[15px]" lang={language === 'en' ? 'en' : 'zh-Hant'}>{cur.caption}</p>}
              </div>
              {dayList.length > 1 && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label="prev" onClick={() => setViewer({ ...viewer, idx: (viewer.idx - 1 + dayList.length) % dayList.length })} className="rounded-full bg-white/15 p-1.5"><ChevronLeft className="h-5 w-5" /></button>
                  <button type="button" aria-label="next" onClick={() => setViewer({ ...viewer, idx: (viewer.idx + 1) % dayList.length })} className="rounded-full bg-white/15 p-1.5"><ChevronRight className="h-5 w-5" /></button>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {confirmDel ? (
                <>
                  <span className="flex-1 text-sm text-white">{t('mo_delete_confirm')}</span>
                  <Button size="sm" variant="destructive" onClick={removeCur}>{t('mode_delete')}</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDel(false)}>{t('cancel')}</Button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDel(true)} className="ml-auto flex items-center gap-1 text-sm text-white/80"><Trash2 className="h-4 w-4" />{t('mode_delete')}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

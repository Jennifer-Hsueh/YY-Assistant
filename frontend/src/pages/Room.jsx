import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useIsDesktop } from '../lib/useIsDesktop';
import { moodEmoji } from '../lib/moods';
import { ymd } from '../lib/recurrence';
import { Card, CardContent } from '../components/ui/card';

// 小河狸的家:房間圖(public/room)上的東西都可以點——月曆=今天行程、To Do=待辦、窗戶=今天心情的天氣、
// 相框=日常時光的照片、書櫃=月刊書櫃、檯燈=開關燈、小河狸=說一句話。座標是圖片寬高的百分比 [左, 上, 右, 下]
const SCENES = {
  sit: {
    src: '/room/room-1.webp', w: 1000, h: 870,
    calendar: [24.0, 31.2, 30.6, 39.0], todo: [36, 35, 44, 47.5], windows: [[45.5, 30.1, 64.0, 50.6]], frame: [72.2, 34.7, 79.7, 43.7],
    shelves: [[13, 40, 41, 64]], beaver: [63, 47, 78, 70], lamps: [[41, 20, 49, 29]],
  },
  walk: {
    src: '/room/room-1b.webp', w: 1000, h: 852,
    calendar: [23.8, 29.3, 30.6, 37.3], todo: [35.5, 33, 43.8, 45.2], windows: [[45.5, 27.8, 64.5, 48.5]], frame: [72.2, 32.3, 80.0, 41.3],
    shelves: [[14, 37, 40, 70]], beaver: [54, 55, 70, 80], lamps: [[41, 18, 49, 27]],
  },
  wide: {
    src: '/room/room-wide.webp', w: 1600, h: 795,
    calendar: [11.7, 31.4, 16.1, 39.0], todo: [19.7, 35.2, 24.9, 47.5], windows: [[25.75, 28.7, 38.1, 51.6], [73.75, 31.4, 84.5, 54]], frame: [90.2, 37.5, 94.25, 46.3],
    shelves: [[6.5, 41, 23, 75], [61, 34, 71, 78]], beaver: [76.5, 56, 87, 83], lamps: [[22.5, 17, 28.5, 30], [70.5, 17, 76.5, 30]], hall: [47, 36, 58, 78],
  },
};

const WEATHER = { sunny: 'sun', flower: 'sun', love: 'sun', exclaim: 'sun', cloudy: 'cloud', question: 'cloud', rainy: 'rain', angry: 'storm', storm: 'storm' };

const box = ([l, t, r, b]) => ({ left: `${l}%`, top: `${t}%`, width: `${r - l}%`, height: `${b - t}%` });

export default function Room() {
  const { t, language } = useLanguage();
  const isDesktop = useIsDesktop();
  // 手機版:每次打開隨機一個場景(小河狸坐著喝咖啡/走來走去)
  const [mobileScene] = useState(() => (Math.random() < 0.5 ? 'sit' : 'walk'));
  const scene = SCENES[isDesktop ? 'wide' : mobileScene];
  const [data, setData] = useState(null);
  const [focus, setFocus] = useState(null); // 'calendar' | 'todo' | 'window' | 'frame' | 'shelf' | 'hall'
  const [night, setNight] = useState(false);
  const [line, setLine] = useState(null);
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const now = new Date();
    const today = ymd(now);
    const ym = today.slice(0, 7);
    const prev = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    Promise.all([
      api.listEvents({ from: dayStart.toISOString(), to: dayEnd.toISOString() }).catch(() => ({ events: [] })),
      api.listNotes({ status: 'open' }).catch(() => ({ notes: [] })),
      api.listMoods({ from: today, to: today }).catch(() => ({ moods: [] })),
      api.listMoments(ym).then((r) => (r.moments.length ? r : api.listMoments(prev))).catch(() => ({ moments: [] })),
      api.listBooks().catch(() => ({ books: [] })),
    ]).then(([{ events }, { notes }, { moods }, { moments }, { books }]) => {
      const withPhoto = (moments || []).filter((m) => m.thumb);
      setData({
        events: (events || []).slice().sort((a, b) => a.start_at.localeCompare(b.start_at)),
        notes: notes || [],
        mood: moods?.[0]?.mood || null,
        photo: withPhoto.length ? withPhoto[Math.floor(Math.random() * withPhoto.length)] : null,
        books: (books || []).length,
      });
    });
  }, []);

  const now = new Date();
  const weekday = t('cal_weekdays')[now.getDay()];
  const weather = data?.mood ? WEATHER[data.mood] : null;

  // 小河狸說的話:依今天的紀錄輪流說
  const lines = useMemo(() => {
    if (!data) return [t('room_hi')];
    const out = [t('room_hi')];
    if (data.events.length) out.push(t('room_events').replace('{n}', data.events.length).replace('{title}', data.events[0].title));
    else out.push(t('room_no_events'));
    if (data.notes.length) out.push(t('room_todos').replace('{n}', data.notes.length));
    if (weather) out.push(t(`room_weather_${weather}`));
    else out.push(t('room_no_mood'));
    if (data.books) out.push(t('room_books').replace('{n}', data.books));
    out.push(t('room_tip'));
    return out;
  }, [data, weather, t]);

  function talk() {
    setLine(lines[lineIdx % lines.length]);
    setLineIdx((i) => i + 1);
  }
  useEffect(() => {
    if (!line) return undefined;
    const id = setTimeout(() => setLine(null), 5000);
    return () => clearTimeout(id);
  }, [line]);

  const pick = (k) => setFocus((f) => (f === k ? null : k));
  const hot = 'room-hot absolute rounded-md';
  const [bl, bt, br] = scene.beaver;
  const cal = scene.calendar;
  const calW = cal[2] - cal[0];

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10">
      <h1 className="page-title-row page-title mb-1 text-lg font-semibold">{t('nav_room')}</h1>
      <p className="mb-3 text-sm text-muted-foreground">{t('room_hint')}</p>

      <div className="room-stage relative mx-auto w-full select-none" style={{ aspectRatio: `${scene.w} / ${scene.h}`, containerType: 'inline-size' }}>
        <img src={scene.src} alt="" className={`absolute inset-0 h-full w-full transition-[filter] duration-500 ${night ? 'room-night' : ''}`} draggable="false" />

        {/* 夜晚:檯燈的光 */}
        {night && scene.lamps.map((l, i) => (
          <span key={i} className="room-glow pointer-events-none absolute" style={{ left: `${(l[0] + l[2]) / 2}%`, top: `${l[3]}%` }} />
        ))}

        {/* 窗外天氣(依今天的心情) */}
        {weather && scene.windows.map((w, i) => (
          <span key={i} className={`room-window room-w-${weather} pointer-events-none absolute`} style={box(w)}>
            {weather === 'sun' && <i className="room-sun" />}
            {(weather === 'rain' || weather === 'storm') && <i className="room-rain" />}
          </span>
        ))}

        {/* 月曆:今天的日期 */}
        <span className="pointer-events-none absolute flex flex-col items-center justify-center rounded-[2px] leading-none" style={{ ...box(cal), background: '#F8DEBA', color: '#5A3B22' }}>
          <b className="font-amount" style={{ fontSize: `${calW * 0.46}cqw` }}>{now.getDate()}</b>
          <span style={{ fontSize: `${calW * 0.2}cqw`, marginTop: `${calW * 0.05}cqw` }}>{language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()] : `週${weekday}`}</span>
        </span>

        {/* 相框:日常時光的照片 */}
        {data?.photo && (
          <span className="pointer-events-none absolute overflow-hidden" style={box(scene.frame)}>
            <img src={data.photo.thumb} alt="" className="h-full w-full object-cover" />
          </span>
        )}

        {/* 待辦的數量 */}
        {data?.notes.length > 0 && (
          <span className="pointer-events-none absolute flex items-center justify-center rounded-full font-semibold text-white shadow"
            style={{ left: `${scene.todo[2] - 1.2}%`, top: `${scene.todo[1] - 1.5}%`, minWidth: `max(16px, ${(scene.todo[2] - scene.todo[0]) * 0.42}cqw)`, height: `max(16px, ${(scene.todo[2] - scene.todo[0]) * 0.42}cqw)`, fontSize: `max(10px, ${(scene.todo[2] - scene.todo[0]) * 0.26}cqw)`, padding: '0 3px', background: '#C1666B' }}>
            {data.notes.length > 9 ? '9+' : data.notes.length}
          </span>
        )}

        {/* 可以點的地方 */}
        {/* 大的(書櫃)放前面,小的(月曆、To Do)放後面,重疊時點得到小的 */}
        {scene.shelves.map((s, i) => <button key={i} type="button" aria-label={t('nav_bookshelf')} className={hot} style={box(s)} onClick={() => pick('shelf')} />)}
        {scene.windows.map((w, i) => <button key={i} type="button" aria-label={t('room_window')} className={hot} style={box(w)} onClick={() => pick('window')} />)}
        <button type="button" aria-label={t('room_calendar')} className={hot} style={box(cal)} onClick={() => pick('calendar')} />
        <button type="button" aria-label={t('room_todo')} className={hot} style={box(scene.todo)} onClick={() => pick('todo')} />
        <button type="button" aria-label={t('room_frame')} className={hot} style={box(scene.frame)} onClick={() => pick('frame')} />
        {scene.lamps.map((l, i) => <button key={i} type="button" aria-label={t('room_lamp')} className={hot} style={box(l)} onClick={() => setNight((v) => !v)} />)}
        {scene.hall && <button type="button" aria-label={t('room_hall')} className={hot} style={box(scene.hall)} onClick={() => pick('hall')} />}
        <button type="button" aria-label="🦫" className={`${hot} room-beaver`} style={box(scene.beaver)} onClick={talk} />

        {line && (
          <span key={line} className="guide-bubble pointer-events-none absolute z-10 rounded-2xl border bg-white px-3 py-1.5 text-[13px] leading-snug shadow-lg md:text-sm"
            style={{ right: `${Math.max(2, 100 - br - 2)}%`, bottom: `${100 - bt + 1}%`, maxWidth: '62%', borderColor: 'rgba(51,65,92,.15)', color: 'var(--ink)' }}>
            {line}
          </span>
        )}
        {/* 讓人知道小河狸可以點 */}
        <span className="room-ping pointer-events-none absolute" style={{ left: `${(bl + br) / 2}%`, top: `${bt}%` }} />
      </div>

      {focus && (
        <Card className="guide-bubble mx-auto mt-3 max-w-xl">
          <CardContent className="space-y-2 p-4 text-sm">
            {focus === 'calendar' && (
              <>
                <p className="font-medium">📅 {t('room_today')} {now.getMonth() + 1}/{now.getDate()}（{weekday}）</p>
                {!data ? <p className="text-muted-foreground">{t('loading')}</p> : data.events.length === 0 ? <p className="text-muted-foreground">{t('room_no_events')}</p> : (
                  <ul className="space-y-1">
                    {data.events.slice(0, 5).map((ev) => (
                      <li key={ev.id} className="flex gap-2"><span className="w-11 shrink-0 font-amount text-xs leading-5 text-muted-foreground">{new Date(ev.start_at).getHours() || new Date(ev.start_at).getMinutes() ? new Date(ev.start_at).toTimeString().slice(0, 5) : t('home_all_day')}</span><span className="min-w-0 truncate">{ev.title}</span></li>
                    ))}
                  </ul>
                )}
                <Link to="/calendar" className="block text-right text-xs text-muted-foreground underline">{t('room_open_calendar')}</Link>
              </>
            )}
            {focus === 'todo' && (
              <>
                <p className="font-medium">📝 {t('room_todo')}</p>
                {!data ? <p className="text-muted-foreground">{t('loading')}</p> : data.notes.length === 0 ? <p className="text-muted-foreground">{t('room_no_todos')}</p> : (
                  <ul className="space-y-1">
                    {data.notes.slice(0, 5).map((n) => <li key={n.id} className="truncate">☐ {n.content}</li>)}
                    {data.notes.length > 5 && <li className="text-xs text-muted-foreground">+{data.notes.length - 5}</li>}
                  </ul>
                )}
                <Link to="/notes" className="block text-right text-xs text-muted-foreground underline">{t('room_open_notes')}</Link>
              </>
            )}
            {focus === 'window' && (
              <>
                <p className="font-medium">🪟 {data?.mood ? `${t('room_mood_today')} ${moodEmoji(data.mood)}` : t('room_no_mood')}</p>
                <p className="text-muted-foreground">{t('room_window_hint')}</p>
                <Link to="/" className="block text-right text-xs text-muted-foreground underline">{t('room_open_home')}</Link>
              </>
            )}
            {focus === 'frame' && (
              <>
                {data?.photo ? (
                  <p className="font-medium">🖼️ {data.photo.date.slice(5).replace('-', '/')}{data.photo.caption ? `　${data.photo.caption}` : ''}</p>
                ) : <p className="text-muted-foreground">{t('room_no_photo')}</p>}
                <Link to="/moments" className="block text-right text-xs text-muted-foreground underline">{t('room_open_moments')}</Link>
              </>
            )}
            {focus === 'shelf' && (
              <>
                <p className="font-medium">📚 {data?.books ? t('room_books').replace('{n}', data.books) : t('room_no_books')}</p>
                <Link to="/bookshelf" className="block text-right text-xs text-muted-foreground underline">{t('room_open_shelf')}</Link>
              </>
            )}
            {focus === 'hall' && <p>🚪 {t('room_hall_soon')}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

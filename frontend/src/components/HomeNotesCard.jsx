import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotebookPen, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardContent } from './ui/card';
import NoteCheck from './NoteCheck';

const SHOW = 5;

// 首頁「墨箋絮語」:只列未完成的筆記,打勾後淡出;下方可快速記一筆
export default function HomeNotesCard({ t, style }) {
  const [notes, setNotes] = useState(null);
  const [leaving, setLeaving] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { notes } = await api.listNotes({ status: 'open' });
      setNotes(notes);
    } catch (err) {
      console.error(err);
      setNotes([]);
    }
  }
  useEffect(() => { load(); }, []);

  async function tick(note) {
    setLeaving((ids) => [...ids, note.id]);
    try {
      await api.updateNote(note.id, { is_done: true });
      setTimeout(() => {
        setNotes((list) => list.filter((n) => n.id !== note.id));
        setLeaving((ids) => ids.filter((id) => id !== note.id));
      }, 350);
    } catch (err) {
      console.error(err);
      setLeaving((ids) => ids.filter((id) => id !== note.id));
    }
  }

  async function quickAdd(e) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const { note } = await api.createNote(draft);
      setNotes((list) => [note, ...(list || [])]);
      setDraft('');
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative z-10 border-none" style={style}>
      <CardContent className="p-4 md:p-5">
        <Link to="/notes" className="mb-3 flex items-center gap-1.5 text-base font-medium" style={{ color: 'var(--module-notes)' }}>
          <NotebookPen className="h-4 w-4" />
          <span className="flex-1">{t('nav_notes')}</span>
          <ChevronRight className="h-4 w-4" />
        </Link>

        {notes === null ? (
          <p className="text-xs text-muted-foreground">{t('loading')}</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('notes_all_done')}</p>
        ) : (
          <ul className="space-y-2">
            {notes.slice(0, SHOW).map((n) => {
              const gone = leaving.includes(n.id);
              return (
                <li key={n.id} className={`flex items-start gap-2.5 transition-opacity duration-300 ${gone ? 'opacity-30' : ''}`}>
                  <NoteCheck done={gone} disabled={gone} onToggle={() => tick(n)} label={t('notes_mark_done')} />
                  <span className={`line-clamp-2 break-words text-sm ${gone ? 'line-through' : ''}`}>{n.content}</span>
                </li>
              );
            })}
            {notes.length > SHOW && (
              <li>
                <Link to="/notes" className="text-xs text-muted-foreground underline">+{notes.length - SHOW}{t('notes_more_suffix')}</Link>
              </li>
            )}
          </ul>
        )}

        <form onSubmit={quickAdd} className="mt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('notes_quick_placeholder')}
            maxLength={2000}
            disabled={busy}
            className="w-full rounded-md border border-border bg-card/70 px-3 py-1.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-[var(--module-notes)]"
          />
        </form>
      </CardContent>
    </Card>
  );
}

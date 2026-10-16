import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useIsDesktop } from '../lib/useIsDesktop';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import NoteCheck from '../components/NoteCheck';

const emptyFilters = { q: '', status: 'all', from: '', to: '' };
const SEG = 'flex-1 rounded-md px-2 py-1.5 transition-colors';
const seg = (on) => `${SEG} ${on ? 'bg-muted font-medium' : 'text-muted-foreground'}`;

// 台灣時間的日期 YYYY-MM-DD
const dayOf = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 未完成在前、已完成在後;各自依建立時間新到舊
const sortNotes = (list) => list.slice().sort((a, b) => (a.is_done === b.is_done ? b.created_at.localeCompare(a.created_at) : a.is_done ? 1 : -1));

export default function Notes() {
  const { t } = useLanguage();
  const isDesktop = useIsDesktop();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  // 新增 / 編輯 / 查詢:點了才出現內容,再點一次收起
  const [mode, setMode] = useState(null);
  const [draft, setDraft] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [editText, setEditText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [busy, setBusy] = useState(false);

  const searching = mode === 'search';
  const hasFilter = Object.keys(emptyFilters).some((k) => filters[k] !== emptyFilters[k]);

  async function load() {
    try {
      const params = {};
      if (searching && hasFilter) {
        if (filters.q.trim()) params.q = filters.q.trim();
        if (filters.status !== 'all') params.status = filters.status;
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
      }
      const { notes } = await api.listNotes(params);
      setNotes(sortNotes(notes));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 查詢條件變動時稍等一下再查
  useEffect(() => {
    const timer = setTimeout(load, searching && hasFilter ? 300 : 0);
    return () => clearTimeout(timer);
  }, [filters, searching]);

  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('yy:data-changed', onChanged);
    return () => window.removeEventListener('yy:data-changed', onChanged);
  }, [filters, searching]);

  function switchMode(next) {
    setMode((cur) => (cur === next ? null : next));
    setActiveId(null);
    setConfirmDelete(false);
    if (next !== 'search') setFilters(emptyFilters);
  }

  async function addNote(e) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const { note } = await api.createNote(draft);
      setNotes((list) => sortNotes([note, ...list]));
      setDraft('');
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(note) {
    const next = !note.is_done;
    setNotes((list) => sortNotes(list.map((n) => (n.id === note.id ? { ...n, is_done: next } : n))));
    try {
      await api.updateNote(note.id, { is_done: next });
    } catch (err) {
      console.error(err);
      load();
    }
  }

  function pickNote(note) {
    if (mode !== 'edit') return;
    setActiveId(note.id);
    setEditText(note.content);
    setConfirmDelete(false);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editText.trim() || busy) return;
    setBusy(true);
    try {
      const { note } = await api.updateNote(activeId, { content: editText });
      setNotes((list) => sortNotes(list.map((n) => (n.id === note.id ? note : n))));
      setActiveId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeNote() {
    setBusy(true);
    try {
      await api.deleteNote(activeId);
      setNotes((list) => list.filter((n) => n.id !== activeId));
      setActiveId(null);
      setConfirmDelete(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const setFilter = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  const actionBar = (
    <div className="mb-3 flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
      <button type="button" onClick={() => switchMode('add')} className={seg(mode === 'add')}>{t('mode_add')}</button>
      <button type="button" onClick={() => switchMode('edit')} className={seg(mode === 'edit')}>{t('mode_edit')}</button>
      <button type="button" onClick={() => switchMode('search')} className={seg(mode === 'search')}>{t('search_title')}</button>
    </div>
  );

  const panel = mode && (
    <Card className="mb-3">
      <CardContent className="space-y-2 p-4">
        {mode === 'add' && (
          <form onSubmit={addNote} className="space-y-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('notes_add_placeholder')}
              rows={3}
              maxLength={2000}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            <Button type="submit" className="w-full" disabled={!draft.trim() || busy}>{t('notes_add')}</Button>
          </form>
        )}

        {mode === 'edit' && !activeId && (
          <p className="py-1 text-center text-sm text-muted-foreground">{t('notes_pick_edit')}</p>
        )}

        {mode === 'edit' && activeId && (
          <form onSubmit={saveEdit} className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              maxLength={2000}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            {confirmDelete ? (
              <div className="space-y-2 rounded-md border border-border p-2">
                <p className="text-sm">{t('notes_confirm_delete')}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" className="flex-1" disabled={busy} onClick={removeNote}>{t('tx_confirm_delete')}</Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>{t('cancel')}</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={!editText.trim() || busy}>{t('tx_save_edit')}</Button>
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>{t('mode_delete')}</Button>
                <Button type="button" variant="outline" onClick={() => setActiveId(null)}>{t('reselect')}</Button>
              </div>
            )}
          </form>
        )}

        {mode === 'search' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t('search_title')}</p>
              {hasFilter && (
                <button type="button" onClick={() => setFilters(emptyFilters)} className="text-xs text-muted-foreground underline">{t('search_clear')}</button>
              )}
            </div>
            <Input placeholder={t('notes_search_keyword')} value={filters.q} onChange={(e) => setFilter('q')(e.target.value)} />
            <div className="flex rounded-lg border border-border bg-card p-1 text-xs">
              {['all', 'open', 'done'].map((s) => (
                <button key={s} type="button" onClick={() => setFilter('status')(s)} className={seg(filters.status === s)}>{t(`notes_status_${s}`)}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">{t('search_date_from')}</span>
                <Input type="date" value={filters.from} onChange={(e) => setFilter('from')(e.target.value)} />
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">{t('search_date_to')}</span>
                <Input type="date" value={filters.to} onChange={(e) => setFilter('to')(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // 手機版查詢:有設定條件才列出結果
  const showList = !(searching && !hasFilter && !isDesktop);

  const list = (
    <div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : !showList ? null : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{searching && hasFilter ? t('notes_no_results') : t('notes_empty')}</p>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {notes.map((n) => {
              const selectable = mode === 'edit';
              const active = activeId === n.id;
              return (
                <li
                  key={n.id}
                  onClick={selectable ? () => pickNote(n) : undefined}
                  className={`flex gap-3 px-4 py-3 ${selectable ? 'cursor-pointer' : ''} ${active ? 'bg-muted' : selectable ? 'hover:bg-muted/50' : ''}`}
                >
                  <NoteCheck done={n.is_done} onToggle={() => toggleDone(n)} label={n.is_done ? t('notes_mark_open') : t('notes_mark_done')} />
                  <div className="min-w-0 flex-1">
                    <p className={`whitespace-pre-wrap break-words text-sm ${n.is_done ? 'text-muted-foreground line-through' : ''}`}>{n.content}</p>
                    <p className="mt-0.5 font-amount text-xs text-muted-foreground">{dayOf(n.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-notes)', '--ring': 'var(--module-notes)' }}>
      <h1 className="page-title-row page-title mb-3 flex items-center gap-2 text-lg font-semibold">
        <NotebookPen className="h-5 w-5 md:hidden" style={{ color: 'var(--module-notes)' }} />
        {t('nav_notes')}
      </h1>

      {isDesktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
          {list}
          <div className="sticky top-6">
            {actionBar}
            {panel}
          </div>
        </div>
      ) : (
        <>
          {actionBar}
          {panel}
          {list}
        </>
      )}
    </div>
  );
}

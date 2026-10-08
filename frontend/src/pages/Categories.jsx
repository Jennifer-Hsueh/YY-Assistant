import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

export default function Categories({ scope = 'ledger' }) {
  const isCalendar = scope === 'calendar';
  const { t } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(isCalendar ? 'event' : 'general');
  const [newColor, setNewColor] = useState('#4F46E5');
  const [colorEditingId, setColorEditingId] = useState(null);
  const [colorDraft, setColorDraft] = useState('#9CA3AF');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { categories } = await api.listCategories();
      setCategories(categories.filter((c) => (isCalendar ? c.type === 'event' : c.type !== 'event')));
    } catch (err) {
      console.error(err);
      setError(t('cat_error_load'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    try {
      await api.createCategory({ name: newName.trim(), type: newType, color: newColor });
      setNewName('');
      setNewType(isCalendar ? 'event' : 'general');
      load();
    } catch (err) {
      console.error(err);
      setError(t('cat_error_create'));
    }
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setDeletingId(null);
    setColorEditingId(null);
  }

  async function saveEdit(id) {
    if (!editName.trim()) return;
    setError('');
    try {
      await api.updateCategory(id, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      load();
    } catch (err) {
      console.error(err);
      setError(t('cat_error_rename'));
    }
  }

  function startColorEdit(cat) {
    setColorEditingId(cat.id);
    setColorDraft(cat.color || '#9CA3AF');
    setEditingId(null);
    setDeletingId(null);
  }

  async function saveColor(id) {
    setError('');
    try {
      await api.updateCategory(id, { color: colorDraft });
      setColorEditingId(null);
      load();
    } catch (err) {
      console.error(err);
      setError(t('cat_error_rename'));
    }
  }

  async function confirmDelete(id) {
    try {
      await api.deleteCategory(id);
      setDeletingId(null);
      load();
    } catch (err) {
      console.error(err);
      setError(t('cat_error_delete'));
    }
  }

  const typeLabel = { expense: t('type_expense'), income: t('type_income'), general: t('type_general') };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32 md:max-w-5xl md:px-8 md:py-10" style={isCalendar ? { '--primary': 'var(--module-calendar)', '--ring': 'var(--module-calendar)' } : { '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <div className="page-title-row mb-4 flex items-center justify-between">
        <h1 className="page-title text-lg font-semibold">{t(isCalendar ? 'cat_calendar_pageTitle' : 'cat_pageTitle')}</h1>
        <Link to={isCalendar ? '/calendar' : '/transactions'} className="text-sm text-muted-foreground underline">{t(isCalendar ? 'cat_back_to_calendar' : 'cat_back_to_transactions')}</Link>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
      <div className="md:sticky md:top-6 md:order-2">
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              type="text"
              placeholder={t('cat_new_name_placeholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            {!isCalendar && (
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-32 whitespace-nowrap"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">{t('type_general')}</SelectItem>
                <SelectItem value="expense">{t('type_expense')}</SelectItem>
                <SelectItem value="income">{t('type_income')}</SelectItem>
              </SelectContent>
            </Select>
            )}
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input" />
            <Button type="submit">{t('acc_add')}</Button>
          </form>
        </CardContent>
      </Card>
      </div>

      <div className="md:order-1">
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {categories.map((cat) => (
              <div key={cat.id} className="px-4 py-3 text-sm">
                {editingId === cat.id ? (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" size="sm" onClick={() => saveEdit(cat.id)}>{t('save')}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>{t('cancel')}</Button>
                  </div>
                ) : colorEditingId === cat.id ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1">{cat.name}</span>
                    <input type="color" value={colorDraft} onChange={(e) => setColorDraft(e.target.value)} className="h-8 w-12 cursor-pointer rounded-md border border-input" />
                    <Button type="button" size="sm" onClick={() => saveColor(cat.id)}>{t('save')}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setColorEditingId(null)}>{t('cancel')}</Button>
                  </div>
                ) : deletingId === cat.id ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('cat_confirm_delete_prefix')}{cat.name}{t('cat_confirm_delete_suffix')}</span>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="destructive" onClick={() => confirmDelete(cat.id)}>{t('mode_delete')}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setDeletingId(null)}>{t('cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ backgroundColor: cat.color || '#9CA3AF' }} />
                      <span>{cat.name}</span>
                      {!isCalendar && <span className="ml-2 text-xs text-muted-foreground">({typeLabel[cat.type] || cat.type})</span>}
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => startEdit(cat)} className="text-xs text-muted-foreground underline">{t('cat_rename')}</button>
                      <button type="button" onClick={() => startColorEdit(cat)} className="text-xs text-muted-foreground underline">{t('cat_reset_color')}</button>
                      <button type="button" onClick={() => setDeletingId(cat.id)} className="text-xs text-red-500 underline">{t('mode_delete')}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('cat_no_categories')}</p>
            )}
          </div>
        </Card>
      )}
      </div>
      </div>
    </div>
  );
}

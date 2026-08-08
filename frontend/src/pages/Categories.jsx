import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

export default function Categories() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('general');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { categories } = await api.listCategories();
      setCategories(categories);
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
      await api.createCategory({ name: newName.trim(), type: newType });
      setNewName('');
      setNewType('general');
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
    <div className="mx-auto max-w-xl px-4 py-6 pb-32" style={{ '--primary': 'var(--module-transactions)', '--ring': 'var(--module-transactions)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('cat_pageTitle')}</h1>
        <Link to="/transactions" className="text-sm text-muted-foreground underline">{t('cat_back_to_transactions')}</Link>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

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
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-32 whitespace-nowrap"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">{t('type_general')}</SelectItem>
                <SelectItem value="expense">{t('type_expense')}</SelectItem>
                <SelectItem value="income">{t('type_income')}</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">{t('acc_add')}</Button>
          </form>
        </CardContent>
      </Card>

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
                      <span>{cat.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({typeLabel[cat.type] || cat.type})</span>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => startEdit(cat)} className="text-xs text-muted-foreground underline">{t('cat_rename')}</button>
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
  );
}

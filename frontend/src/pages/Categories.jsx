import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

export default function Categories() {
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
      setError('無法載入分類清單');
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
      setError('新增失敗,可能是分類名稱重複');
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
      setError('重新命名失敗,可能是名稱重複');
    }
  }

  async function confirmDelete(id) {
    try {
      await api.deleteCategory(id);
      setDeletingId(null);
      load();
    } catch (err) {
      console.error(err);
      setError('刪除失敗');
    }
  }

  const typeLabel = { expense: '支出', income: '收入', general: '通用' };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-32">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">分類管理</h1>
        <Link to="/transactions" className="text-sm text-muted-foreground underline">回記帳</Link>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              type="text"
              placeholder="新分類名稱"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">通用</SelectItem>
                <SelectItem value="expense">支出</SelectItem>
                <SelectItem value="income">收入</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">新增</Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">載入中…</p>
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
                    <Button type="button" size="sm" onClick={() => saveEdit(cat.id)}>儲存</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>取消</Button>
                  </div>
                ) : deletingId === cat.id ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">確定刪除「{cat.name}」?</span>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="destructive" onClick={() => confirmDelete(cat.id)}>刪除</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setDeletingId(null)}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span>{cat.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({typeLabel[cat.type] || cat.type})</span>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => startEdit(cat)} className="text-xs text-muted-foreground underline">重新命名</button>
                      <button type="button" onClick={() => setDeletingId(cat.id)} className="text-xs text-red-500 underline">刪除</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">還沒有任何分類,新增第一個吧</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, Info } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { downloadBackup, downloadLedgerExcel } from '../lib/dataTransfer';
import { usePlan } from '../context/PlanContext';
import { ReadOnlyNotice } from './PlanNotice';

const emptyFilters = { from: '', to: '', type: 'all', account: '', category: '' };

// 設定 → 資料匯出 / 備份
export default function DataTransferCard({ t }) {
  const { can } = usePlan();
  const [busy, setBusy] = useState(null); // 'excel' | 'backup' | 'restore'
  const [message, setMessage] = useState(null); // { ok, text }
  const [restoreFile, setRestoreFile] = useState(null);
  const backupInput = useRef(null);

  // 匯出 Excel:先選條件(只匯出帳務)
  const [excelOpen, setExcelOpen] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const setFilter = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  async function run(kind, fn) {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setMessage({ ok: false, text: t('data_failed') });
    } finally {
      setBusy(null);
    }
  }

  async function openExcel() {
    if (excelOpen) { setExcelOpen(false); return; }
    setExcelOpen(true);
    setMessage(null);
    try {
      const [{ accounts }, { categories }] = await Promise.all([api.listAccounts(), api.listCategories()]);
      setAccounts(accounts);
      setCategories(categories.filter((c) => c.type !== 'event'));
    } catch (err) {
      console.error(err);
    }
  }

  const exportExcel = () => run('excel', async () => {
    const count = await downloadLedgerExcel(await api.exportData(), filters);
    setMessage(count
      ? { ok: true, text: `${t('data_excel_done_prefix')}${count}${t('data_imported_suffix')}` }
      : { ok: false, text: t('data_excel_none') });
  });
  const exportBackup = () => run('backup', async () => downloadBackup(await api.exportData()));

  const restore = () => run('restore', async () => {
    const backup = JSON.parse(await restoreFile.text());
    if (!backup?.data) throw new Error('not a backup file');
    await api.importData({ mode: 'replace', data: backup.data });
    setRestoreFile(null);
    setMessage({ ok: true, text: t('data_restored') });
  });

  const label = 'mb-1 block text-xs text-muted-foreground';

  // 資料匯出與備份屬於進階功能
  if (!can('export')) {
    return (
      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">{t('data_title')}</p>
          <ReadOnlyNotice feature="export" locked className="" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-3">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{t('data_title')}</p>

        <div className="grid grid-cols-2 gap-2">
          <Button variant={excelOpen ? 'default' : 'outline'} className="col-span-2" onClick={openExcel} disabled={!!busy}>
            <Download className="mr-1.5 h-4 w-4" />{t('data_export_excel')}
          </Button>
          <Button variant="outline" onClick={exportBackup} disabled={!!busy}>
            <Download className="mr-1.5 h-4 w-4" />{busy === 'backup' ? t('loading') : t('data_export_backup')}
          </Button>
          <Button variant="outline" onClick={() => backupInput.current?.click()} disabled={!!busy}>
            <Upload className="mr-1.5 h-4 w-4" />{t('data_restore')}
          </Button>
        </div>

        {excelOpen && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">{t('data_excel_title')}</p>
            <p className="flex gap-1.5 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('data_excel_note')}
            </p>
            <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
              <div>
                <span className={label}>{t('search_date_from')}</span>
                <Input type="date" value={filters.from} onChange={(e) => setFilter('from')(e.target.value)} />
              </div>
              <div>
                <span className={label}>{t('search_date_to')}</span>
                <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to')(e.target.value)} />
              </div>
              <Select value={filters.type} onValueChange={setFilter('type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('data_excel_all_types')}</SelectItem>
                  <SelectItem value="expense">{t('type_expense')}</SelectItem>
                  <SelectItem value="income">{t('type_income')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.account || 'all'} onValueChange={(v) => setFilter('account')(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('data_excel_all_accounts')}</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="col-span-2">
                <Select value={filters.category || 'all'} onValueChange={(v) => setFilter('category')(v === 'all' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('data_excel_all_categories')}</SelectItem>
                    {[...new Set(categories.map((c) => c.name))].map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={exportExcel} disabled={!!busy}>
                {busy === 'excel' ? t('loading') : t('data_excel_run')}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setExcelOpen(false); setFilters(emptyFilters); }} disabled={!!busy}>{t('cancel')}</Button>
            </div>
          </div>
        )}

        <input ref={backupInput} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setRestoreFile(f); setMessage(null); } }} />

        {restoreFile && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <AlertTriangle className="h-4 w-4" />{t('data_restore_confirm_title')}
            </p>
            <p className="text-xs text-muted-foreground">{restoreFile.name} — {t('data_restore_confirm_body')}</p>
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={restore} disabled={busy === 'restore'}>
                {busy === 'restore' ? t('loading') : t('data_restore')}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setRestoreFile(null)} disabled={busy === 'restore'}>{t('cancel')}</Button>
            </div>
          </div>
        )}

        {message && <p className={`text-xs ${message.ok ? 'text-green-600' : 'text-destructive'}`}>{message.text}</p>}
      </CardContent>
    </Card>
  );
}

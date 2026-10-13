import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { downloadBackup, downloadExcel, readTransactionsFromExcel } from '../lib/dataTransfer';

// 設定 → 資料匯出 / 匯入
export default function DataTransferCard({ t }) {
  const [busy, setBusy] = useState(null); // 'excel' | 'backup' | 'import-excel' | 'restore'
  const [message, setMessage] = useState(null); // { ok, text }
  const [restoreFile, setRestoreFile] = useState(null);
  const excelInput = useRef(null);
  const backupInput = useRef(null);

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

  const exportExcel = () => run('excel', async () => downloadExcel(await api.exportData()));
  const exportBackup = () => run('backup', async () => downloadBackup(await api.exportData()));

  const importExcel = (file) => run('import-excel', async () => {
    const rows = await readTransactionsFromExcel(file);
    const { summary } = await api.importData({ mode: 'append', transactions: rows });
    let text = `${t('data_imported_prefix')}${summary.transactions}${t('data_imported_suffix')}`;
    if (summary.skipped) text += `,${t('data_skipped_prefix')}${summary.skipped}${t('data_imported_suffix')}`;
    if (summary.unknown_accounts?.length) text += `。${t('data_unknown_accounts')}${summary.unknown_accounts.join('、')}`;
    setMessage({ ok: true, text });
  });

  const restore = () => run('restore', async () => {
    const backup = JSON.parse(await restoreFile.text());
    if (!backup?.data) throw new Error('not a backup file');
    await api.importData({ mode: 'replace', data: backup.data });
    setRestoreFile(null);
    setMessage({ ok: true, text: t('data_restored') });
  });

  return (
    <Card className="mb-3">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{t('data_title')}</p>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={!!busy}>
            <Download className="mr-1.5 h-4 w-4" />{busy === 'excel' ? t('loading') : t('data_export_excel')}
          </Button>
          <Button variant="outline" onClick={exportBackup} disabled={!!busy}>
            <Download className="mr-1.5 h-4 w-4" />{busy === 'backup' ? t('loading') : t('data_export_backup')}
          </Button>
          <Button variant="outline" onClick={() => excelInput.current?.click()} disabled={!!busy}>
            <Upload className="mr-1.5 h-4 w-4" />{busy === 'import-excel' ? t('loading') : t('data_import_excel')}
          </Button>
          <Button variant="outline" onClick={() => backupInput.current?.click()} disabled={!!busy}>
            <Upload className="mr-1.5 h-4 w-4" />{t('data_restore')}
          </Button>
        </div>

        <input ref={excelInput} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importExcel(f); }} />
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

// 匯出帳務 Excel / 備份檔(exceljs 只在用到時才載入)
import { localDate } from './budget';

const loadExcel = async () => (await import('exceljs/dist/exceljs.min.js')).default;

const TYPE_LABEL = { expense: '支出', income: '收入' };

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// 檔名用英數字:部分瀏覽器會把中文檔名改成 "download"
const stamp = () => localDate(new Date().toISOString()).replaceAll('-', '');

export function downloadBackup(backup) {
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `YY-Assistant-backup-${stamp()}.json`);
}

// 只匯出帳務(記帳明細),依使用者選的條件篩選;回傳匯出筆數
// filters: { from, to, type: 'all' | 'expense' | 'income', account, category }
export async function downloadLedgerExcel({ data }, filters) {
  const accName = (id) => data.accounts.find((a) => a.id === id)?.name || '';
  const accCur = (id) => data.accounts.find((a) => a.id === id)?.currency || 'TWD';
  const rows = [...data.transactions]
    .filter((t) => {
      const day = localDate(t.occurred_at);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.account && t.account_id !== filters.account) return false;
      if (filters.category && (t.category || '') !== filters.category) return false;
      return true;
    })
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  if (rows.length === 0) return 0;

  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('記帳');
  ws.columns = [['日期', 'date', 12], ['類型', 'type', 8], ['金額', 'amount', 12], ['幣別', 'currency', 8], ['帳戶', 'account', 14], ['分類', 'category', 12], ['說明', 'note', 30]]
    .map(([header, key, width]) => ({ header, key, width }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((t) => ws.addRow({
    date: localDate(t.occurred_at), type: TYPE_LABEL[t.type], amount: Number(t.amount),
    currency: accCur(t.account_id), account: accName(t.account_id), category: t.category || '', note: t.note || '',
  }));

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `YY-Assistant-ledger-${stamp()}.xlsx`);
  return rows.length;
}

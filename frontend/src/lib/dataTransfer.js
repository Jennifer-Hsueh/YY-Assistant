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

// 從備份 ZIP 裡取出 backup.json(也接受直接選 backup.json)
export async function readBackupFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (!isZip) return JSON.parse(new TextDecoder().decode(buf));
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('bad zip');
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < total; n += 1) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (name.split('/').pop() === 'backup.json') {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      let bytes = buf.subarray(start, start + size);
      if (method === 8) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('backup.json not found');
}

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

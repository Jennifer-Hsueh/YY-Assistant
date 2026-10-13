// 匯出 Excel / 備份檔,以及讀取 Excel 記帳明細(exceljs 只在用到時才載入)
import { localDate } from './budget';

const loadExcel = async () => (await import('exceljs/dist/exceljs.min.js')).default;

const MOOD_LABEL = { sunny: '☀️ 晴', cloudy: '⛅ 多雲', rainy: '🌧️ 雨', storm: '⛈️ 雷雨', rainbow: '🌈 彩虹' };
const TYPE_LABEL = { expense: '支出', income: '收入', event: '行程' };

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

function timeOf(iso) {
  const d = new Date(iso);
  return d.getHours() === 0 && d.getMinutes() === 0 ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function downloadExcel({ data }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const accName = (id) => data.accounts.find((a) => a.id === id)?.name || '';
  const accCur = (id) => data.accounts.find((a) => a.id === id)?.currency || 'TWD';
  const sheet = (name, columns, rows) => {
    const ws = wb.addWorksheet(name);
    ws.columns = columns.map(([header, key, width]) => ({ header, key, width }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
  };

  sheet('記帳', [['日期', 'date', 12], ['類型', 'type', 8], ['金額', 'amount', 12], ['幣別', 'currency', 8], ['帳戶', 'account', 14], ['分類', 'category', 12], ['說明', 'note', 30]],
    [...data.transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).map((t) => ({
      date: localDate(t.occurred_at), type: TYPE_LABEL[t.type], amount: Number(t.amount),
      currency: accCur(t.account_id), account: accName(t.account_id), category: t.category || '', note: t.note || '',
    })));
  sheet('帳戶', [['名稱', 'name', 16], ['幣別', 'currency', 8], ['餘額', 'balance', 14]],
    data.accounts.map((a) => ({ name: a.name, currency: a.currency || 'TWD', balance: Number(a.balance) })));
  sheet('行程', [['日期', 'date', 12], ['時間', 'time', 8], ['標題', 'title', 24], ['分類', 'category', 12], ['備註', 'note', 30]],
    [...data.events].sort((a, b) => a.start_at.localeCompare(b.start_at)).map((e) => ({
      date: localDate(e.start_at), time: timeOf(e.start_at), title: e.title, category: e.category || '', note: e.note || '',
    })));
  sheet('循環', [['類型', 'kind', 8], ['名稱', 'title', 18], ['金額', 'amount', 12], ['帳戶', 'account', 14], ['分類', 'category', 12], ['每月幾號', 'day', 10], ['下次日期', 'next', 12], ['結束日', 'end', 12], ['狀態', 'status', 8]],
    data.recurring_items.map((r) => ({
      kind: TYPE_LABEL[r.kind], title: r.title, amount: r.amount != null ? Number(r.amount) : '', account: accName(r.account_id),
      category: r.category || '', day: r.day_of_month, next: r.next_trigger_date, end: r.end_date || '', status: r.is_active ? '啟用中' : '停用中',
    })));
  sheet('預算', [['分類', 'category', 14], ['每月預算(TWD)', 'amount', 16]],
    data.budgets.map((b) => ({ category: b.category || '總預算', amount: Number(b.amount) })));
  sheet('心情', [['日期', 'date', 12], ['心情', 'mood', 10]],
    [...data.moods].sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ date: m.date, mood: MOOD_LABEL[m.mood] || m.mood })));

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `YY-Assistant-${stamp()}.xlsx`);
}

// 讀取 Excel 的「記帳」工作表(或第一個工作表),欄位:日期、類型、金額、帳戶、分類、說明
export async function readTransactionsFromExcel(file) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet('記帳') || wb.worksheets[0];
  if (!ws) return [];
  const header = {};
  ws.getRow(1).eachCell((cell, col) => { header[String(cell.value ?? '').trim()] = col; });
  const col = (row, ...names) => {
    for (const n of names) if (header[n]) {
      const v = row.getCell(header[n]).value;
      return v && typeof v === 'object' && 'result' in v ? v.result : v;
    }
    return null;
  };
  const rows = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const rawDate = col(row, '日期', 'date');
    const date = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate ?? '').trim().replaceAll('/', '-');
    const typeRaw = String(col(row, '類型', 'type') ?? '').trim();
    rows.push({
      date,
      type: typeRaw === '收入' || typeRaw === 'income' ? 'income' : typeRaw === '支出' || typeRaw === 'expense' ? 'expense' : '',
      amount: Number(col(row, '金額', 'amount')),
      account: String(col(row, '帳戶', 'account') ?? '').trim() || null,
      category: String(col(row, '分類', 'category') ?? '').trim() || null,
      note: String(col(row, '說明', 'note') ?? '').trim() || null,
    });
  });
  return rows;
}

import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Badge, Card, PageTitle } from '../ui';

// 【暫時功能】使用狀況:誰有持續輸入資料(測試期間用,之後會拿掉)
const MIN_DAYS = 5;

export default function Activity() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  useEffect(() => { api.activity().then((d) => setRows(d.users)).catch((e) => setError(e.message)); }, []);

  const list = useMemo(() => (rows || []).filter((r) => !onlyActive || r.last7 > 0), [rows, onlyActive]);
  const sum = useMemo(() => {
    const r = rows || [];
    return { all: r.length, week: r.filter((x) => x.last7 > 0).length, never: r.filter((x) => x.total === 0).length, five: r.filter((x) => x.use_days >= MIN_DAYS).length };
  }, [rows]);

  return (
    <>
      <PageTitle>使用狀況</PageTitle>
      <p className="-mt-3 mb-4 text-xs text-muted-foreground">
        筆數＝記帳、行程、記事、文章、日常時光照片、小紙條（註冊時自動建立的分類、帳戶不算）。使用天數＝有輸入或打開 App 的日子，滿 {MIN_DAYS} 天符合創始會員資格。
      </p>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {rows && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <span>使用者 <b className="num">{sum.all}</b></span>
          <span>近 7 天有輸入 <b className="num">{sum.week}</b></span>
          <span>使用滿 {MIN_DAYS} 天 <b className="num">{sum.five}</b></span>
          <span>從沒輸入 <b className="num">{sum.never}</b></span>
          <label className="ml-auto flex items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />只看近 7 天有輸入
          </label>
        </div>
      )}
      <Card className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">稱呼 / Email</th>
              <th className="px-3 py-2.5 text-right font-medium">近 7 天筆數</th>
              <th className="px-3 py-2.5 text-right font-medium">總筆數</th>
              <th className="px-3 py-2.5 text-right font-medium">有輸入的天數</th>
              <th className="px-3 py-2.5 font-medium">使用天數（創始）</th>
              <th className="px-3 py-2.5 font-medium">最後輸入</th>
              <th className="px-3 py-2.5 font-medium">最後上線</th>
              <th className="px-3 py-2.5 font-medium">註冊</th>
            </tr>
          </thead>
          <tbody>
            {!rows && !error && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">讀取中…</td></tr>}
            {list.map((r) => (
              <tr key={r.id} className={`border-b border-border last:border-0 ${r.is_disabled ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2.5">
                  <div>{r.username || '（未設定）'}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="num px-3 py-2.5 text-right font-semibold">{r.last7}</td>
                <td className="num px-3 py-2.5 text-right">{r.total}</td>
                <td className="num px-3 py-2.5 text-right">{r.entry_days}</td>
                <td className="px-3 py-2.5">
                  <span className="num mr-2">{Math.min(r.use_days, MIN_DAYS)} / {MIN_DAYS}{r.use_days > MIN_DAYS ? `（${r.use_days}）` : ''}</span>
                  {r.is_tester ? <span className="text-xs text-muted-foreground">測試員</span> : r.founding_member ? <Badge tone="green">已標創始</Badge> : r.founding_removed ? <span className="text-xs text-muted-foreground">已取消</span> : r.use_days >= MIN_DAYS ? <Badge tone="amber">符合，未標記</Badge> : null}
                </td>
                <td className="num px-3 py-2.5 text-muted-foreground">{r.last_entry || '—'}</td>
                <td className="num px-3 py-2.5 text-muted-foreground">{r.last_active || '—'}</td>
                <td className="num px-3 py-2.5 text-muted-foreground">{r.created || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

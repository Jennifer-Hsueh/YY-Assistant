import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { api } from '../api';
import { fmtDateTime } from '../labels';
import { Badge, Button, Card, PageTitle, Segmented, inputCls } from '../ui';

const STATUS = { new: ['未處理', 'red'], in_progress: ['處理中', 'amber'], done: ['已完成', 'green'] };

// 使用者代理字串 → 簡短的裝置/瀏覽器描述
function device(ua) {
  if (!ua) return '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, br].filter(Boolean).join(' · ');
}

function ReportCard({ report, onChange, go }) {
  const [note, setNote] = useState(report.admin_note || '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save(body) {
    setBusy(true);
    setError('');
    try {
      const { report: r } = await api.updateBugReport(report.id, body);
      onChange({ ...report, ...r });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const who = report.reporter ? `${report.reporter.username || '(未設定稱呼)'} · ${report.reporter.email}` : `${report.email || '(已刪除的帳號)'}`;
  const [label, tone] = STATUS[report.status] || ['—', 'gray'];

  return (
    <Card className="p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{label}</Badge>
        <p className="font-medium">{report.title}</p>
        <span className="num ml-auto text-xs text-muted-foreground">{fmtDateTime(report.created_at)}</span>
      </div>
      <p className="mb-1 text-xs text-muted-foreground">{who}{report.user_agent ? ` · ${device(report.user_agent)}` : ''}</p>
      <p className="mb-4 whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-sm">{report.description}</p>

      <div className="flex items-start gap-3">
        <textarea
          className={`${inputCls} h-16 flex-1 resize-y py-2`}
          placeholder="處理備註(只有後台看得到)"
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex w-40 shrink-0 flex-col gap-2">
          <select className={inputCls} value={report.status} disabled={busy} onChange={(e) => save({ status: e.target.value })}>
            {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Button variant="outline" disabled={busy || note === (report.admin_note || '')} onClick={() => save({ admin_note: note })}>{saved ? '已儲存' : '儲存備註'}</Button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {report.user_id && (
          <Button variant="ghost" className="px-2 text-ink" onClick={() => go('announcements', { to: report.user_id, title: `回覆:${report.title}`.slice(0, 120) })}>
            <Megaphone className="h-4 w-4" />發公告回覆這位使用者
          </Button>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Card>
  );
}

export default function BugReports({ go }) {
  const [status, setStatus] = useState('open');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setList(null);
    api.bugReports(status).then(({ reports }) => setList(reports)).catch((e) => setError(e.message));
  }, [status]);

  return (
    <>
      <PageTitle>故障通報</PageTitle>
      <div className="mb-4">
        <Segmented value={status} onChange={setStatus} options={[['open', '待處理'], ['new', '未處理'], ['in_progress', '處理中'], ['done', '已完成'], ['all', '全部']]} />
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {!list ? (
        <p className="text-sm text-muted-foreground">載入中…</p>
      ) : list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">沒有通報</Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              go={go}
              onChange={(nr) => setList((l) => l.map((x) => (x.id === nr.id ? nr : x)))}
            />
          ))}
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Megaphone, ShieldAlert, Bug, DatabaseBackup, LogOut } from 'lucide-react';
import { api, getToken, setToken } from './api';
import Login from './pages/Login';
import Overview from './pages/Overview';
import UsersPage from './pages/Users';
import Announcements from './pages/Announcements';
import Reports from './pages/Reports';
import BugReports from './pages/BugReports';
import Backups from './pages/Backups';

const NAV = [
  ['overview', '總覽', LayoutDashboard],
  ['users', '使用者管理', Users],
  ['announcements', '公告管理', Megaphone],
  ['reports', '檢舉與社群', ShieldAlert],
  ['bugs', '故障通報', Bug],
  ['backups', '備份還原', DatabaseBackup],
];

// 以網址 # 記住目前頁面(例如 #users?status=expiring)
function readHash() {
  const [page, query = ''] = window.location.hash.slice(1).split('?');
  return { page: NAV.some(([k]) => k === page) ? page : 'overview', params: Object.fromEntries(new URLSearchParams(query)) };
}

export default function App() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [route, setRoute] = useState(readHash);

  useEffect(() => {
    if (getToken()) {
      api.me().then(({ admin }) => setAdmin(admin)).catch(() => setToken(null)).finally(() => setChecking(false));
    }
    const onLogout = () => setAdmin(null);
    const onHash = () => setRoute(readHash());
    window.addEventListener('yy-admin:logout', onLogout);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('yy-admin:logout', onLogout);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const go = (page, params = {}) => {
    const q = new URLSearchParams(params).toString();
    window.location.hash = q ? `${page}?${q}` : page;
  };

  function logout() {
    setToken(null);
    setAdmin(null);
  }

  if (checking) return <p className="p-10 text-sm text-muted-foreground">載入中…</p>;
  if (!admin) return <Login onLogin={setAdmin} />;

  const { page, params } = route;
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card/70 px-4 py-6">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <img src="/round-logo.png" alt="" className="h-9 w-9 rounded-full" />
          <div>
            <p className="text-sm font-semibold text-ink">YY手帳</p>
            <p className="text-xs text-muted-foreground">管理後台</p>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => go(key)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${page === key ? 'bg-ink text-white' : 'text-foreground/80 hover:bg-muted'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-border px-2 pt-4">
          <p className="truncate text-sm">{admin.username || '管理員'}</p>
          <p className="mb-3 truncate text-xs text-muted-foreground">{admin.email}</p>
          <button type="button" onClick={logout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-danger">
            <LogOut className="h-3.5 w-3.5" />登出
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8">
        <div className="mx-auto max-w-6xl">
          {page === 'overview' && <Overview go={go} />}
          {page === 'users' && <UsersPage key={JSON.stringify(params)} initial={params} selfId={admin.id} />}
          {page === 'announcements' && <Announcements key={JSON.stringify(params)} initial={params} />}
          {page === 'reports' && <Reports key={JSON.stringify(params)} initial={params} />}
          {page === 'bugs' && <BugReports go={go} />}
          {page === 'backups' && <Backups />}
        </div>
      </main>
    </div>
  );
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'yy_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if ((res.status === 401 || res.status === 403) && auth) {
    setToken(null);
    window.dispatchEvent(new Event('yy-admin:logout'));
  }
  if (!res.ok) {
    const err = new Error(data.error || `操作失敗（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => request('/admin/me'),
  overview: () => request('/admin/overview'),
  beta: () => request('/admin/settings/beta'),
  setBeta: (body) => request('/admin/settings/beta', { method: 'PUT', body }),
  clearBetaData: (confirm) => request('/admin/beta/clear-data', { method: 'POST', body: { confirm } }),
  markFounding: () => request('/admin/founding/mark', { method: 'POST', body: {} }),
  grantFounding: () => request('/admin/founding/grant', { method: 'POST', body: {} }),
  bulkDeleteUsers: (ids, confirm) => request('/admin/users/bulk-delete', { method: 'POST', body: { ids, confirm } }),
  users: (params) => request(`/admin/users${qs(params)}`),
  updateUser: (id, body) => request(`/admin/users/${id}`, { method: 'PUT', body }),
  moderation: (id) => request(`/admin/users/${id}/moderation`),
  moderate: (id, body) => request(`/admin/users/${id}/moderation`, { method: 'POST', body }),
  resetLink: (id) => request(`/admin/users/${id}/reset-link`, { method: 'POST' }),
  payments: (id) => request(`/admin/users/${id}/payments`),
  addPayment: (id, body) => request(`/admin/users/${id}/payments`, { method: 'POST', body }),
  deletePayment: (id, pid) => request(`/admin/users/${id}/payments/${pid}`, { method: 'DELETE' }),
  announcements: () => request('/admin/announcements'),
  createAnnouncement: (body) => request('/admin/announcements', { method: 'POST', body }),
  updateAnnouncement: (id, body) => request(`/admin/announcements/${id}`, { method: 'PUT', body }),
  deleteAnnouncement: (id) => request(`/admin/announcements/${id}`, { method: 'DELETE' }),
  reports: (filter) => request(`/admin/reports${qs({ filter })}`),
  setHidden: (id, hidden, extra = {}) => request(`/admin/posts/${id}/hidden`, { method: 'PUT', body: { hidden, ...extra } }),
  deletePost: (id) => request(`/admin/posts/${id}`, { method: 'DELETE' }),
  wishes: (status) => request(`/admin/wishes${qs({ status })}`),
  bugReports: (status) => request(`/admin/bug-reports${qs({ status })}`),
  updateBugReport: (id, body) => request(`/admin/bug-reports/${id}`, { method: 'PUT', body }),
  backups: () => request('/admin/backups'),
  backupSummary: (path, user) => request(`/admin/backups/summary${qs({ path, user })}`),
  restoreBackup: (body) => request('/admin/backups/restore', { method: 'POST', body }),
  // 下載備份檔(帶登入憑證,取得檔案後交給瀏覽器存檔)
  async downloadBackup(path) {
    const res = await fetch(`${BASE_URL}/admin/backups/download${qs({ path })}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('下載失敗');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  setWishStatus: (id, wish_status) => request(`/admin/posts/${id}/wish-status`, { method: 'PUT', body: { wish_status } }),
};

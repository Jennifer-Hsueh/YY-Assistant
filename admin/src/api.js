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
    const err = new Error(data.error || `Request failed (${res.status})`);
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
  users: (params) => request(`/admin/users${qs(params)}`),
  updateUser: (id, body) => request(`/admin/users/${id}`, { method: 'PUT', body }),
  payments: (id) => request(`/admin/users/${id}/payments`),
  addPayment: (id, body) => request(`/admin/users/${id}/payments`, { method: 'POST', body }),
  deletePayment: (id, pid) => request(`/admin/users/${id}/payments/${pid}`, { method: 'DELETE' }),
  announcements: () => request('/admin/announcements'),
  createAnnouncement: (body) => request('/admin/announcements', { method: 'POST', body }),
  updateAnnouncement: (id, body) => request(`/admin/announcements/${id}`, { method: 'PUT', body }),
  deleteAnnouncement: (id) => request(`/admin/announcements/${id}`, { method: 'DELETE' }),
  reports: (filter) => request(`/admin/reports${qs({ filter })}`),
  setHidden: (id, hidden) => request(`/admin/posts/${id}/hidden`, { method: 'PUT', body: { hidden } }),
  deletePost: (id) => request(`/admin/posts/${id}`, { method: 'DELETE' }),
  wishes: (status) => request(`/admin/wishes${qs({ status })}`),
  setWishStatus: (id, wish_status) => request(`/admin/posts/${id}/wish-status`, { method: 'PUT', body: { wish_status } }),
};

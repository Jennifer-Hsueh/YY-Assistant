const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 登入過期(或 token 無效)時:清掉登入資料,通知 AuthContext 導回登入頁
export const SESSION_EXPIRED_KEY = 'yy_session_expired';

export function clearSession({ expired = false } = {}) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (expired) sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
  window.dispatchEvent(new Event('yy:unauthorized'));
}

// 只解讀 JWT 的到期時間(不驗證簽章,驗證仍由後端負責)
export function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function getToken() {
  return localStorage.getItem('token'); // ok in a real browser; PWA-safe (not an in-artifact context)
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    clearSession({ expired: true });
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (email, password) => request('/auth/register', { method: 'POST', body: { email, password }, auth: false }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  requestPasswordReset: (email) => request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (email, token, newPassword) =>
    request('/auth/reset-password', { method: 'POST', body: { email, token, newPassword }, auth: false }),

  listTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions${qs ? `?${qs}` : ''}`);
  },
  createTransaction: (payload) => request('/transactions', { method: 'POST', body: payload }),
  updateTransaction: (id, payload) => request(`/transactions/${id}`, { method: 'PUT', body: payload }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  listAccounts: () => request('/accounts'),
  createAccount: (payload) => request('/accounts', { method: 'POST', body: payload }),
  transferBetweenAccounts: (payload) => request('/accounts/transfer', { method: 'POST', body: payload }),
  updateAccount: (id, payload) => request(`/accounts/${id}`, { method: 'PUT', body: payload }),
deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),

  listEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/events${qs ? `?${qs}` : ''}`);
  },
  createEvent: (payload) => request('/events', { method: 'POST', body: payload }),
  updateEvent: (id, payload) => request(`/events/${id}`, { method: 'PUT', body: payload }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),

  listRecurringItems: () => request('/recurring-items'),
  createRecurringItem: (payload) => request('/recurring-items', { method: 'POST', body: payload }),
  updateRecurringItem: (id, payload) => request(`/recurring-items/${id}`, { method: 'PUT', body: payload }),
  deleteRecurringItem: (id) => request(`/recurring-items/${id}`, { method: 'DELETE' }),

  registerPushSubscription: (fcm_token) => request('/push-subscriptions', { method: 'POST', body: { fcm_token } }),
  unregisterPushSubscription: (fcm_token) => request('/push-subscriptions', { method: 'DELETE', body: { fcm_token } }),
  listCategories: () => request('/categories'),
createCategory: (payload) => request('/categories', { method: 'POST', body: payload }),
updateCategory: (id, payload) => request(`/categories/${id}`, { method: 'PUT', body: payload }),
deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
clearAllData: () => request('/categories/all-data', { method: 'DELETE' }),
listAnnouncements: () => request('/announcements'),
getProfile: () => request('/profile'),
updateProfile: (payload) => request('/profile', { method: 'PUT', body: payload }),
submitBugReport: (payload) => request('/bug-reports', { method: 'POST', body: payload }),
getExchangeRate: (from, to) => request(`/exchange-rate?from=${from}&to=${to}`),

  listPosts: (params = {}) => request(`/community/posts?${new URLSearchParams(params).toString()}`),
  getCommunityStats: () => request('/community/stats'),
  createPost: (payload) => request('/community/posts', { method: 'POST', body: payload }),
  updatePost: (id, payload) => request(`/community/posts/${id}`, { method: 'PUT', body: payload }),
  deletePost: (id) => request(`/community/posts/${id}`, { method: 'DELETE' }),
  listComments: (id) => request(`/community/posts/${id}/comments`),
  createComment: (id, content) => request(`/community/posts/${id}/comments`, { method: 'POST', body: { content } }),
  deleteComment: (id) => request(`/community/comments/${id}`, { method: 'DELETE' }),
  reactToPost: (id, type) => request(`/community/posts/${id}/react`, { method: 'POST', body: { type } }),
  reportPost: (id, reason) => request(`/community/posts/${id}/report`, { method: 'POST', body: { reason } }),
  setWishStatus: (id, wish_status) => request(`/community/posts/${id}/status`, { method: 'PUT', body: { wish_status } }),

};

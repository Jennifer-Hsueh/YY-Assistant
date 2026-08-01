const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
};

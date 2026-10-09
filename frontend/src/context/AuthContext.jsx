import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, clearSession, isTokenExpired } from '../lib/api';
import { applyTheme } from '../lib/theme';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!raw) return null;
    // 打開 App 時 token 已過期(或不存在):直接當作未登入,不要先顯示空白資料
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.setItem('yy_session_expired', '1');
      return null;
    }
    return JSON.parse(raw);
  });

  // 任何 API 回 401 → 回到登入頁
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('yy:unauthorized', onUnauthorized);
    return () => window.removeEventListener('yy:unauthorized', onUnauthorized);
  }, []);

  // 使用中途 token 到期(例如 App 一直開著):每分鐘檢查一次
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) clearSession({ expired: true });
    }, 60000);
    return () => clearInterval(timer);
  }, [user]);

  // 登入後以伺服器上的主題設定為準,讓 Web 與 APP 一致
  useEffect(() => {
    if (!user) return;
    api.getProfile()
      .then(({ profile }) => { if (profile?.theme) applyTheme(profile.theme); })
      .catch(() => {});
  }, [user]);

  const login = useCallback(async (email, password) => {
    const { user, token } = await api.login(email, password);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  }, []);

  const register = useCallback(async (email, password) => {
    const { user, token } = await api.register(email, password);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('yy_session_expired');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

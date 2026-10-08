import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { applyTheme } from '../lib/theme';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

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

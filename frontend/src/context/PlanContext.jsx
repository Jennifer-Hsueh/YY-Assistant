import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

// 目前方案的功能權限(以後端為準;前端只用來隱藏不能用的按鈕與顯示提示)
const PlanContext = createContext({ ent: null, termsOk: true, can: () => true, refresh: () => {} });

export function PlanProvider({ children }) {
  const { user } = useAuth();
  const [ent, setEnt] = useState(null);
  const [termsOk, setTermsOk] = useState(true);

  const refresh = useCallback(() => {
    if (!user) { setEnt(null); setTermsOk(true); return; }
    api.getProfile().then(({ profile }) => {
      setEnt(profile?.ent || null);
      setTermsOk(profile?.terms_ok !== false);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    refresh();
    window.addEventListener('yy:plan-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('yy:plan-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  // 還沒載入時先當作可以用(避免畫面閃一下鎖住)
  const can = useCallback((feature) => !ent || ent.features.includes(feature), [ent]);

  return <PlanContext.Provider value={{ ent, termsOk, can, refresh }}>{children}</PlanContext.Provider>;
}

export const usePlan = () => useContext(PlanContext);

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, LEDGER_KEY } from '../lib/api';
import { useAuth } from './AuthContext';

// 目前的帳本:記帳、帳戶、預算、循環記帳都依這本讀寫(api.js 會帶 X-Ledger 標頭)
const LedgerContext = createContext(null);

const stored = () => { try { return localStorage.getItem(LEDGER_KEY); } catch { return null; } };

export function LedgerProvider({ children }) {
  const { user } = useAuth();
  const [ledgers, setLedgers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [currentId, setCurrentId] = useState(stored);
  const [version, setVersion] = useState(0); // 切換帳本時 +1,頁面重新載入資料

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const { ledgers: list, invites: inv } = await api.listLedgers();
      setLedgers(list);
      setInvites(inv || []);
      const keep = stored();
      if (!keep || !list.some((l) => l.id === keep)) {
        const def = list.find((l) => l.is_default) || list[0];
        if (def) {
          // 預設帳本不必帶標頭(後端沒收到就用預設);記下 id 讓畫面知道目前是哪本
          localStorage.setItem(LEDGER_KEY, def.id);
          setCurrentId(def.id);
        }
      }
    } catch { /* 讀不到帳本時維持原樣,記帳仍會使用預設帳本 */ }
  }, [user]);

  useEffect(() => {
    if (!user) { setLedgers([]); setInvites([]); setCurrentId(null); return; }
    setCurrentId(stored());
    reload();
  }, [user, reload]);

  // 後端說記住的帳本不存在:重新讀取並回到預設帳本
  useEffect(() => {
    const onReset = () => { setCurrentId(null); setVersion((v) => v + 1); reload(); };
    window.addEventListener('yy:ledger-reset', onReset);
    return () => window.removeEventListener('yy:ledger-reset', onReset);
  }, [reload]);

  const select = useCallback((id) => {
    localStorage.setItem(LEDGER_KEY, id);
    setCurrentId(id);
    setVersion((v) => v + 1);
  }, []);

  const current = ledgers.find((l) => l.id === currentId) || null;
  return (
    <LedgerContext.Provider value={{ ledgers, invites, current, currentId, version, select, reload }}>
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  return useContext(LedgerContext) || { ledgers: [], invites: [], current: null, currentId: null, version: 0, select: () => {}, reload: () => {} };
}

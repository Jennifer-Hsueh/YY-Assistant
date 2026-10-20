import { useState } from 'react';
import { api } from '../lib/api';
import { usePlan } from '../context/PlanContext';
import { useAuth } from '../context/AuthContext';
import { LegalOverlay } from '../pages/Legal';
import { Button } from './ui/button';

// 還沒同意(或條款改版後)目前版本的使用條款時,擋在畫面上要求同意
export default function TermsConsentModal() {
  const { termsOk, refresh } = usePlan();
  const { logout } = useAuth();
  const [doc, setDoc] = useState(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (termsOk) return null;

  async function accept() {
    setBusy(true);
    setError('');
    try {
      await api.acceptTerms();
      refresh();
    } catch {
      setError('送出失敗,請稍後再試');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-5 shadow-xl">
        <p className="font-semibold">使用條款與隱私權政策</p>
        <p className="text-sm text-muted-foreground">請閱讀並同意後繼續使用。</p>
        <ConsentCheck checked={checked} onChange={setChecked} onOpen={setDoc} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={logout}>登出</Button>
          <Button className="flex-1" disabled={!checked || busy} onClick={accept}>同意並繼續</Button>
        </div>
      </div>
      <LegalOverlay doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

// 「我已閱讀並同意 使用條款 與 隱私權政策」勾選框(註冊頁共用)
export function ConsentCheck({ checked, onChange, onOpen }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        我已閱讀並同意
        <button type="button" className="mx-0.5 underline" onClick={(e) => { e.preventDefault(); onOpen('terms'); }}>使用條款</button>
        與
        <button type="button" className="mx-0.5 underline" onClick={(e) => { e.preventDefault(); onOpen('privacy'); }}>隱私權政策</button>
      </span>
    </label>
  );
}

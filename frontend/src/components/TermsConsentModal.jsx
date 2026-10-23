import { useState } from 'react';
import { api } from '../lib/api';
import { usePlan } from '../context/PlanContext';
import { useAuth } from '../context/AuthContext';
import { LegalOverlay } from '../pages/Legal';
import { Button } from './ui/button';
import { useAuthText } from '../lib/authText';

// 還沒同意(或條款改版後)目前版本的使用條款時,擋在畫面上要求同意
export default function TermsConsentModal() {
  const { termsOk, refresh } = usePlan();
  const { A } = useAuthText();
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
      setError(A.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-5 shadow-xl">
        <p className="font-semibold">{A.consentTitle}</p>
        <p className="text-sm text-muted-foreground">{A.consentDesc}</p>
        <ConsentCheck checked={checked} onChange={setChecked} onOpen={setDoc} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={logout}>{A.logout}</Button>
          <Button className="flex-1" disabled={!checked || busy} onClick={accept}>{A.agreeContinue}</Button>
        </div>
      </div>
      <LegalOverlay doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

// 「我已閱讀並同意 使用條款 與 隱私權政策」勾選框(註冊頁共用)
export function ConsentCheck({ checked, onChange, onOpen }) {
  const { A } = useAuthText();
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {A.agree}
        <button type="button" className="mx-0.5 underline" onClick={(e) => { e.preventDefault(); onOpen('terms'); }}>{A.terms}</button>
        {A.and}
        <button type="button" className="mx-0.5 underline" onClick={(e) => { e.preventDefault(); onOpen('privacy'); }}>{A.privacy}</button>
      </span>
    </label>
  );
}

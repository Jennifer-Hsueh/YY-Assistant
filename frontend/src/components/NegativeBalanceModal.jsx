import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { accountLabel } from '../lib/banks';

// 記帳、修改、轉帳後帳戶會變成負數時,後端回 NEGATIVE_BALANCE,這裡跳出提醒(全站共用一個視窗)
const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function NegativeBalanceModal() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const on = (e) => setInfo(e.detail || {});
    window.addEventListener('yy:negative-balance', on);
    return () => window.removeEventListener('yy:negative-balance', on);
  }, []);

  if (!info) return null;
  const a = info.account;
  const close = () => setInfo(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6" onClick={close}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="nb-title" className="w-full max-w-xs rounded-2xl bg-card p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--expense-bg)] text-[var(--expense)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p id="nb-title" className="mb-1 font-semibold">{t('nb_title')}</p>
        {a ? (
          <p className="text-sm text-muted-foreground">
            {t('nb_body_1')}<span className="font-medium text-foreground">{accountLabel(a)}</span>{t('nb_body_2')}
            <span className="font-amount font-medium text-[var(--expense)]">{a.currency} {fmt(a.after)}</span>
            {t('nb_body_3')}{a.currency} {fmt(a.balance)}{t('nb_body_4')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('nb_opening')}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{t('nb_hint')}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={close} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">{t('nb_ok')}</button>
          <button type="button" onClick={() => { close(); navigate('/accounts'); }} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{t('nb_to_accounts')}</button>
        </div>
      </div>
    </div>
  );
}

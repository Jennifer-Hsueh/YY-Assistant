import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Clock, Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { usePlan } from '../context/PlanContext';
import { useLanguage } from '../context/LanguageContext';
import { planText } from '../lib/planText';
import { FEATURE_KEYS } from '../lib/plans';
import { Card, CardContent } from './ui/card';

const fmt = (ymd) => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '');

// 沒有權限時:跳出視窗告知(任何地方呼叫 askUpgrade,或 API 回 PLAN_REQUIRED 時)
export function askUpgrade(feature) {
  window.dispatchEvent(new CustomEvent('yy:plan-locked', { detail: { feature } }));
}

// 放在路由裡(ProtectedLayout),全站共用一個視窗
export function PlanLockModal() {
  const { ent } = usePlan();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [feature, setFeature] = useState(null);

  useEffect(() => {
    const onLocked = (e) => setFeature(e.detail?.feature || 'ledger');
    window.addEventListener('yy:plan-locked', onLocked);
    return () => window.removeEventListener('yy:plan-locked', onLocked);
  }, []);

  if (!feature) return null;
  const T = planText(language);
  const name = T.feat[feature] || feature;
  const needChoice = ent?.status === 'basic' && !ent.basic_choice && (feature === 'ledger' || feature === 'calendar');
  const close = () => setFeature(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6" onClick={close}>
      <div role="dialog" aria-modal="true" className="w-full max-w-xs rounded-2xl bg-card p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5" />
        </div>
        <p className="mb-1 font-semibold">{T.lockTitle}</p>
        <p className="text-sm text-muted-foreground">{needChoice ? T.chooseNow : T.locked(name)}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={close} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">{T.ok}</button>
          <button type="button" onClick={() => { close(); navigate('/settings#plan'); }} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{T.viewPlan}</button>
        </div>
      </div>
    </div>
  );
}

// 包住整塊沒有權限的區域:看得到,點了就跳出提示
export function LockedArea({ feature, children, className = '' }) {
  const { can } = usePlan();
  if (can(feature)) return children;
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none opacity-60" aria-hidden="true">{children}</div>
      <button type="button" aria-label="locked" onClick={() => askUpgrade(feature)} className="absolute inset-0 cursor-pointer" />
    </div>
  );
}

// 首頁:試用快結束、方案快到期、寬限期、需要選擇基本功能時提示
export function PlanBanner() {
  const { ent } = usePlan();
  const { language } = useLanguage();
  if (!ent) return null;
  const T = planText(language);
  let text = null;
  if (ent.status === 'trial' && ent.days_left !== null && ent.days_left <= 30) text = T.bannerTrial(ent.days_left, fmt(ent.trial_ends_at));
  else if (ent.status === 'active' && ent.days_left !== null && ent.days_left <= 30) text = T.bannerExpire(ent.days_left, fmt(ent.expires_at));
  else if (ent.status === 'grace') text = T.bannerGrace(fmt(ent.grace_ends_at));
  else if (ent.status === 'basic' && !ent.basic_choice) text = T.bannerChoose;
  if (!text) return null;
  const urgent = ent.status === 'grace' || (ent.status === 'basic' && !ent.basic_choice) || (ent.days_left !== null && ent.days_left <= 3);
  return (
    <Link
      to="/settings#plan"
      className={`relative z-10 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${urgent ? 'bg-[var(--expense-bg)] text-[var(--expense)]' : 'bg-card/80 text-foreground'}`}
    >
      <Clock className="h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <span className="shrink-0 text-xs underline">{T.viewPlan}</span>
    </Link>
  );
}

// 設定頁「我的方案」
export function PlanCard() {
  const { ent, refresh } = usePlan();
  const { language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 從「查看方案」連過來時捲到這張卡片
  useEffect(() => {
    if (ent && window.location.hash === '#plan') document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ent]);
  if (!ent) return null;
  const T = planText(language);
  const isBasic = ent.status === 'basic';

  async function choose(choice) {
    if (choice === ent.basic_choice) return;
    setBusy(true);
    setError('');
    try {
      await api.setBasicChoice(choice);
      refresh();
      window.dispatchEvent(new Event('yy:data-changed'));
    } catch (err) {
      setError(err.code === 'CHOICE_LOCKED' ? T.chooseLocked : err.message);
    } finally {
      setBusy(false);
    }
  }

  const planName = ent.status === 'trial' ? T.status.trial
    : ent.status === 'staff' ? T.status.staff
      : isBasic ? T.plan.basic
        : `${T.plan[ent.plan]}${ent.addon_community && ent.plan !== 'full' ? T.addon : ''}`;

  const row = 'flex items-center justify-between text-sm';
  return (
    <Card id="plan" className="mb-3 scroll-mt-20">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{T.title}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{T.status[ent.status]}</span>
        </div>
        <p className="text-base font-semibold">{planName}</p>

        <div className="space-y-1.5">
          {ent.status === 'trial' && <div className={row}><span className="text-muted-foreground">{T.trialUntil}</span><span className="font-amount">{ent.trial_ends_at}</span></div>}
          {(ent.status === 'active' || ent.status === 'grace') && (
            <div className={row}><span className="text-muted-foreground">{T.expires}</span><span className="font-amount">{ent.expires_at || T.unlimited}</span></div>
          )}
          {ent.status === 'grace' && <div className={row}><span className="text-muted-foreground">{T.graceUntil}</span><span className="font-amount text-[var(--expense)]">{ent.grace_ends_at}</span></div>}
        </div>

        {ent.status !== 'staff' && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">{T.features}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {FEATURE_KEYS.map((f) => {
                const on = ent.features.includes(f);
                return (
                  <span key={f} className={`flex items-center gap-1.5 ${on ? '' : 'text-muted-foreground/70'}`}>
                    {on ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5" />}{T.feat[f]}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {(isBasic || ent.status === 'trial') && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">{T.chooseTitle}</p>
            <p className="text-xs text-muted-foreground">{ent.status === 'trial' ? T.trialNote + ' ' : ''}{T.chooseHint}</p>
            <div className="flex rounded-lg border border-border bg-card p-1 text-sm">
              {['ledger', 'calendar'].map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={busy || (!ent.can_change_choice && ent.basic_choice !== c)}
                  onClick={() => choose(c)}
                  className={`flex-1 rounded-md px-2 py-1.5 transition-colors disabled:opacity-50 ${ent.basic_choice === c ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
                >
                  {T.choice[c]}
                </button>
              ))}
            </div>
            {!ent.can_change_choice && isBasic && <p className="text-xs text-muted-foreground">{T.chooseLocked}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {ent.status !== 'staff' && (
          <div className="space-y-1.5 rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium">{T.prices}</p>
            {T.priceRows.map(([label, m]) => (
              <div key={label} className="flex items-baseline justify-between gap-2 text-xs">
                <span>{label}</span>
                <span className="font-amount text-muted-foreground">{m} {T.perMonth}・{T.perYear(m * 12 - 100)}</span>
              </div>
            ))}
            <ul className="space-y-0.5 pt-1 text-[11px] text-muted-foreground">
              {['adv_a', 'adv_b', 'adv_c', 'full'].map((p) => <li key={p}>{T.plan[p]}：{T.planDesc[p]}</li>)}
            </ul>
            <p className="pt-1 text-xs text-muted-foreground">{T.contact}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

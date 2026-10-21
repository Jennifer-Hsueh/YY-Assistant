import { AlertTriangle } from 'lucide-react';
import { usePlan } from '../context/PlanContext';

// 讀不到帳號資料時(伺服器錯誤或連不上),在每頁上方提示
export default function ProfileErrorBanner() {
  const { loadError, refresh } = usePlan();
  if (!loadError) return null;
  return (
    <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive md:mx-8">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">無法讀取帳號資料</span>
      <button type="button" onClick={refresh} className="shrink-0 underline">重試</button>
    </div>
  );
}

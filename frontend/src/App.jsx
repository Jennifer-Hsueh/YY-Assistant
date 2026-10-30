import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { PlanProvider } from './context/PlanContext';
import { LedgerProvider, useLedger } from './context/LedgerContext';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import BeaverBubble from './components/BeaverBubble';
import Sidebar from './components/Sidebar';
import FloatingAddButton from './components/FloatingAddButton';
import { PlanLockModal } from './components/PlanNotice';
import TermsConsentModal from './components/TermsConsentModal';
import { isNative } from './lib/platform';
import UpdatePrompt from './components/UpdatePrompt';
import ProfileErrorBanner from './components/ProfileErrorBanner';
import BetaEndBanner from './components/BetaEndBanner';
import { initNativeApp } from './lib/nativeApp';

// 各頁面用到時才載入,第一次打開比較快。
// 網站更新後,舊版頁面檔可能已不存在 → 自動重新整理一次載入新版
function page(load) {
  return lazy(() => load().then((m) => { sessionStorage.removeItem('yy_chunk_reload'); return m; }).catch((err) => {
    const key = 'yy_chunk_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
      return new Promise(() => {});
    }
    throw err;
  }));
}
const Legal = page(() => import('./pages/Legal'));
const Help = page(() => import('./pages/Help'));
const Landing = page(() => import('./pages/Landing'));
const AddFriend = page(() => import('./pages/AddFriend'));
const Login = page(() => import('./pages/Login'));
const Register = page(() => import('./pages/Register'));
const ForgotPassword = page(() => import('./pages/ForgotPassword'));
const ResetPassword = page(() => import('./pages/ResetPassword'));
const Home = page(() => import('./pages/Home'));
const Transactions = page(() => import('./pages/Transactions'));
const CalendarPage = page(() => import('./pages/CalendarPage'));
const Accounts = page(() => import('./pages/Accounts'));
const RecurringMoney = page(() => import('./pages/RecurringMoney'));
const LedgerStats = page(() => import('./pages/LedgerStats'));
const RecurringEvents = page(() => import('./pages/RecurringEvents'));
const Anniversaries = page(() => import('./pages/Anniversaries'));
const CalendarStats = page(() => import('./pages/CalendarStats'));
const Categories = page(() => import('./pages/Categories'));
const Announcements = page(() => import('./pages/Announcements'));
const Notes = page(() => import('./pages/Notes'));
const Community = page(() => import('./pages/Community'));
const Settings = page(() => import('./pages/Settings'));

function ProtectedLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen overflow-x-clip">
      <Sidebar />
      {/* 手機版:多留出 iPhone 底部安全區域的高度,內容不會被底部導覽列蓋住 */}
      <div className="pb-[env(safe-area-inset-bottom)] md:pb-0 md:pl-56">
        <TopBar />
        <ProfileErrorBanner />
        <BetaEndBanner />
        {/* 頁面載入中時,側邊選單與頂部列先顯示 */}
        <Suspense fallback={<div className="min-h-[60vh]" />}>{children}</Suspense>
      </div>
      <BottomNav />
      <FloatingAddButton />
      <BeaverBubble />
      <PlanLockModal />
      <TermsConsentModal />
    </div>
  );
}

// 首頁:已登入 → 手帳首頁;未登入 → 網頁版顯示入口頁、APP 版到登入頁
function RootRoute() {
  const { user } = useAuth();
  if (user) return <ProtectedLayout><Home /></ProtectedLayout>;
  if (isNative) return <Navigate to="/login" replace />;
  return <Landing />;
}

// APP 版:狀態列、返回鍵、點推播開啟頁面(網頁版不做任何事)
function NativeBridge() {
  const navigate = useNavigate();
  useEffect(() => { initNativeApp(navigate); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// 好友邀請連結:登入後顯示在一般版面裡;還沒登入由頁面自己導去註冊
function AddFriendRoute() {
  const { user } = useAuth();
  return user ? <ProtectedLayout><AddFriend /></ProtectedLayout> : <AddFriend />;
}

// 切換帳本時重新載入所有頁面的資料
function LedgerRoutes({ children }) {
  const { version } = useLedger();
  return <Routes key={version}>{children}</Routes>;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PlanProvider>
        <LedgerProvider>
        <BrowserRouter>
          <NativeBridge />
          {!isNative && <UpdatePrompt />}
          <Suspense fallback={null}>
          <LedgerRoutes>
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/" element={<RootRoute />} />
            <Route path="/add-friend" element={<AddFriendRoute />} />

            <Route path="/transactions" element={<ProtectedLayout><Transactions /></ProtectedLayout>} />
            <Route path="/accounts" element={<ProtectedLayout><Accounts /></ProtectedLayout>} />
            <Route path="/recurring-money" element={<ProtectedLayout><RecurringMoney /></ProtectedLayout>} />
            <Route path="/ledger-stats" element={<ProtectedLayout><LedgerStats /></ProtectedLayout>} />

            <Route path="/calendar" element={<ProtectedLayout><CalendarPage /></ProtectedLayout>} />
            <Route path="/recurring-events" element={<ProtectedLayout><RecurringEvents /></ProtectedLayout>} />
            <Route path="/anniversaries" element={<ProtectedLayout><Anniversaries /></ProtectedLayout>} />
            <Route path="/calendar-stats" element={<ProtectedLayout><CalendarStats /></ProtectedLayout>} />

            <Route path="/announcements" element={<ProtectedLayout><Announcements /></ProtectedLayout>} />
            <Route path="/community" element={<ProtectedLayout><Community /></ProtectedLayout>} />
            <Route path="/community/:board" element={<ProtectedLayout><Community /></ProtectedLayout>} />
            <Route path="/notes" element={<ProtectedLayout><Notes /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/help" element={<ProtectedLayout><Help /></ProtectedLayout>} />

            <Route path="/categories" element={<ProtectedLayout><Categories /></ProtectedLayout>} />
            <Route path="/calendar-categories" element={<ProtectedLayout><Categories scope="calendar" /></ProtectedLayout>} />
          </LedgerRoutes>
          </Suspense>
        </BrowserRouter>
        </LedgerProvider>
        </PlanProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

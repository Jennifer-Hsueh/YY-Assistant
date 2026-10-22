import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { PlanProvider } from './context/PlanContext';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import FloatingAddButton from './components/FloatingAddButton';
import { PlanLockModal } from './components/PlanNotice';
import TermsConsentModal from './components/TermsConsentModal';
import Legal from './pages/Legal';
import Help from './pages/Help';
import Landing from './pages/Landing';
import { isNative } from './lib/platform';
import ProfileErrorBanner from './components/ProfileErrorBanner';
import { initNativeApp } from './lib/nativeApp';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import CalendarPage from './pages/CalendarPage';
import Accounts from './pages/Accounts';
import RecurringMoney from './pages/RecurringMoney';
import LedgerStats from './pages/LedgerStats';
import RecurringEvents from './pages/RecurringEvents';
import CalendarStats from './pages/CalendarStats';
import Categories from './pages/Categories';
import Announcements from './pages/Announcements';
import Notes from './pages/Notes';
import Community from './pages/Community';
import Settings from './pages/Settings';

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
        {children}
      </div>
      <BottomNav />
      <FloatingAddButton />
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

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PlanProvider>
        <BrowserRouter>
          <NativeBridge />
          <Routes>
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/" element={<RootRoute />} />

            <Route path="/transactions" element={<ProtectedLayout><Transactions /></ProtectedLayout>} />
            <Route path="/accounts" element={<ProtectedLayout><Accounts /></ProtectedLayout>} />
            <Route path="/recurring-money" element={<ProtectedLayout><RecurringMoney /></ProtectedLayout>} />
            <Route path="/ledger-stats" element={<ProtectedLayout><LedgerStats /></ProtectedLayout>} />

            <Route path="/calendar" element={<ProtectedLayout><CalendarPage /></ProtectedLayout>} />
            <Route path="/recurring-events" element={<ProtectedLayout><RecurringEvents /></ProtectedLayout>} />
            <Route path="/calendar-stats" element={<ProtectedLayout><CalendarStats /></ProtectedLayout>} />

            <Route path="/announcements" element={<ProtectedLayout><Announcements /></ProtectedLayout>} />
            <Route path="/community" element={<Navigate to="/community/mood" replace />} />
            <Route path="/community/:board" element={<ProtectedLayout><Community /></ProtectedLayout>} />
            <Route path="/notes" element={<ProtectedLayout><Notes /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/help" element={<ProtectedLayout><Help /></ProtectedLayout>} />

            <Route path="/categories" element={<ProtectedLayout><Categories /></ProtectedLayout>} />
            <Route path="/calendar-categories" element={<ProtectedLayout><Categories scope="calendar" /></ProtectedLayout>} />
          </Routes>
        </BrowserRouter>
        </PlanProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

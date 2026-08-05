import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import CalendarPage from './pages/CalendarPage';
import Accounts from './pages/Accounts';
import RecurringMoney from './pages/RecurringMoney';
import RecurringEvents from './pages/RecurringEvents';
import Categories from './pages/Categories';
import Announcements from './pages/Announcements';
import Community from './pages/Community';
import Settings from './pages/Settings';

function ProtectedLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen">
      <TopBar />
      {children}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/" element={<ProtectedLayout><Home /></ProtectedLayout>} />

            <Route path="/transactions" element={<ProtectedLayout><Transactions /></ProtectedLayout>} />
            <Route path="/accounts" element={<ProtectedLayout><Accounts /></ProtectedLayout>} />
            <Route path="/recurring-money" element={<ProtectedLayout><RecurringMoney /></ProtectedLayout>} />

            <Route path="/calendar" element={<ProtectedLayout><CalendarPage /></ProtectedLayout>} />
            <Route path="/recurring-events" element={<ProtectedLayout><RecurringEvents /></ProtectedLayout>} />

            <Route path="/announcements" element={<ProtectedLayout><Announcements /></ProtectedLayout>} />
            <Route path="/community" element={<ProtectedLayout><Community /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />

            <Route path="/categories" element={<ProtectedLayout><Categories /></ProtectedLayout>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

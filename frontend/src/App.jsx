import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import BottomNav from './components/BottomNav';
import FloatingAddButton from './components/FloatingAddButton';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import CalendarPage from './pages/CalendarPage';
import Accounts from './pages/Accounts';
import Recurring from './pages/Recurring';

function ProtectedLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
      <BottomNav />
      <FloatingAddButton />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedLayout>
                <Transactions />
              </ProtectedLayout>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedLayout>
                <CalendarPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedLayout>
                <Accounts />
              </ProtectedLayout>
            }
          />
          <Route
            path="/recurring"
            element={
              <ProtectedLayout>
                <Recurring />
              </ProtectedLayout>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

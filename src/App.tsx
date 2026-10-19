import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import ProtectedRoutes from './components/ProtectedRoutes';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SetupPage from './pages/SetupPage';

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { session, staff, workspace, loading } = useAuth();
  if (loading) return null;
  if (session && staff && workspace) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LandingOrApp() {
  const { session, staff, workspace, loading } = useAuth();
  if (loading) return null;
  if (session && staff && workspace) return <AppShell />;
  if (session) return <Navigate to="/setup" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<AuthRedirect><SignInPage /></AuthRedirect>} />
          <Route path="/sign-up" element={<AuthRedirect><SignUpPage /></AuthRedirect>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/" element={<LandingOrApp />} />
          <Route
            path="/*"
            element={
              <ProtectedRoutes>
                <AppShell />
              </ProtectedRoutes>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

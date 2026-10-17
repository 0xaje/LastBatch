import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import ProtectedRoutes from './components/ProtectedRoutes';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import SetupPage from './pages/SetupPage';

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { session, staff, workspace, loading } = useAuth();
  if (loading) return null;
  if (session && staff && workspace) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<AuthRedirect><SignInPage /></AuthRedirect>} />
          <Route path="/sign-up" element={<AuthRedirect><SignUpPage /></AuthRedirect>} />
          <Route path="/setup" element={<SetupPage />} />
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

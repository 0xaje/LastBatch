import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ProtectedRoutes from './components/ProtectedRoutes';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SetupPage from './pages/SetupPage';

export function WorkspaceLoadFailure() {
  const { workspaceError, refreshWorkspace } = useAuth();
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
      <Box sx={{ maxWidth: 420, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Workspace temporarily unavailable</Typography>
        <Typography sx={{ mb: 3 }} color="text.secondary">{workspaceError ?? 'Your workspace could not be loaded.'}</Typography>
        <Button variant="contained" onClick={() => void refreshWorkspace()}>Retry workspace lookup</Button>
      </Box>
    </Box>
  );
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { session, staff, workspace, loading, workspaceError } = useAuth();
  if (loading) return null;
  if (session && workspaceError) return <WorkspaceLoadFailure />;
  if (session && staff && workspace) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LandingOrApp() {
  const { session, staff, workspace, loading, workspaceError } = useAuth();
  if (loading) return null;
  if (session && workspaceError) return <WorkspaceLoadFailure />;
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

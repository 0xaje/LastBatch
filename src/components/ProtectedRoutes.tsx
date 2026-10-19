import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function ProtectedRoutes({ children }: { children: ReactNode }) {
  const { session, staff, workspace, loading, refreshWorkspace } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary">Loading LastBatch…</Typography>
      </Box>
    );
  }

  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;

  if (!staff) {
    return <Navigate to="/setup" replace />;
  }

  if (!workspace) {
    return <WorkspaceMissing onRefresh={() => void refreshWorkspace()} />;
  }

  return <>{children}</>;
}

function WorkspaceMissing({ onRefresh }: { onRefresh: () => void }) {
  const [checking, setChecking] = useState(true);
  const [hasWorkspace, setHasWorkspace] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('workspaces').select('id, name, created_by, created_at').limit(1).maybeSingle();
      setHasWorkspace(Boolean(data));
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!hasWorkspace) {
    // No workspace exists yet: this user should create one
    return <Navigate to="/setup" replace />;
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'background.default' }}>
      <Box sx={{ textAlign: 'center', maxWidth: 380 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Workspace unavailable</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your account is not connected to a workspace yet. If your manager created one, you can join from the setup screen.
        </Typography>
        <Button variant="contained" onClick={onRefresh} sx={{ mr: 1 }}>
          Retry
        </Button>
        <Button variant="text" onClick={() => { window.location.href = '/setup'; }}>
          Go to setup
        </Button>
      </Box>
    </Box>
  );
}

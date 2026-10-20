import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useAuth } from '../lib/auth';

export default function ProtectedRoutes({ children }: { children: ReactNode }) {
  const { session, staff, workspace, loading, refreshWorkspace, workspaceError } = useAuth();
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

  if (workspaceError) {
    return <WorkspaceMissing onRefresh={() => void refreshWorkspace()} error={workspaceError} />;
  }

  if (!staff) {
    return <Navigate to="/setup" replace />;
  }

  if (!workspace) {
    return <WorkspaceMissing onRefresh={() => void refreshWorkspace()} />;
  }

  return <>{children}</>;
}

function WorkspaceMissing({ onRefresh, error }: { onRefresh: () => void; error?: string }) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Workspace unavailable</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error ?? 'Your workspace could not be loaded. Please retry rather than creating another workspace.'}
        </Typography>
        <Button variant="contained" onClick={onRefresh}>Retry workspace lookup</Button>
      </Box>
    </Box>
  );
}

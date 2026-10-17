import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import StorefrontIcon from '@mui/icons-material/Storefront';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { friendlyDbError } from '../lib/format';

type Mode = 'choose' | 'create' | 'join';

export default function SetupPage() {
  const { session, staff, workspace, loading, refreshWorkspace } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('choose');
  const [workspaceName, setWorkspaceName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [joinAvailable, setJoinAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
      setJoinAvailable(Boolean(data));
    })();
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!session) return <Navigate to="/sign-in" replace />;
  if (staff && workspace) return <Navigate to="/" replace />;

  const validate = (needWorkspaceName: boolean): string | null => {
    if (needWorkspaceName && workspaceName.trim().length === 0) return 'Please enter your shop name.';
    if (needWorkspaceName && workspaceName.trim().length > 80) return 'Shop name must be 80 characters or fewer.';
    if (displayName.trim().length === 0) return 'Please enter your name.';
    if (displayName.trim().length > 80) return 'Name must be 80 characters or fewer.';
    return null;
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(true);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('create_workspace_with_manager', {
      p_name: workspaceName.trim(),
      p_display_name: displayName.trim(),
    });
    if (rpcError) {
      setError(friendlyDbError(rpcError.message));
      setSubmitting(false);
      return;
    }
    await refreshWorkspace();
    navigate('/', { replace: true });
  };

  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(false);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('join_workspace', {
      p_display_name: displayName.trim(),
    });
    if (rpcError) {
      setError(friendlyDbError(rpcError.message));
      setSubmitting(false);
      return;
    }
    await refreshWorkspace();
    navigate('/', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 440, p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Set up your workspace
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {mode === 'choose'
            ? 'Create a workspace for your shop, or join one your manager already created.'
            : mode === 'create'
              ? 'You will be the manager of this workspace.'
              : 'You will join as staff. A manager can promote you later.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {mode === 'choose' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<StorefrontIcon />}
              onClick={() => setMode('create')}
              sx={{ py: 2 }}
            >
              Create a new workspace
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<GroupAddIcon />}
              disabled={!joinAvailable}
              onClick={() => setMode('join')}
              sx={{ py: 2 }}
            >
              {joinAvailable ? 'Join an existing workspace' : 'No workspace exists yet'}
            </Button>
          </Box>
        )}

        {mode === 'create' && (
          <Box component="form" onSubmit={onCreate} noValidate>
            <TextField
              label="Shop name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              fullWidth
              margin="normal"
              required
              placeholder="e.g. Corner Bakery"
            />
            <TextField
              label="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              margin="normal"
              required
              placeholder="e.g. Alex Johnson"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              sx={{ mt: 2 }}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {submitting ? 'Creating…' : 'Create workspace'}
            </Button>
            <Button variant="text" fullWidth onClick={() => { setMode('choose'); setError(null); }} sx={{ mt: 1 }}>
              Back
            </Button>
          </Box>
        )}

        {mode === 'join' && (
          <Box component="form" onSubmit={onJoin} noValidate>
            <TextField
              label="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              margin="normal"
              required
              placeholder="e.g. Sam Lee"
              helperText="Use your real name so your team recognizes your records"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              sx={{ mt: 2 }}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {submitting ? 'Joining…' : 'Join workspace'}
            </Button>
            <Button variant="text" fullWidth onClick={() => { setMode('choose'); setError(null); }} sx={{ mt: 1 }}>
              Back
            </Button>
          </Box>
        )}

        {mode === 'choose' && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
              MVP note: this version supports a single workspace. Anyone who signs up can join it as staff; the creator is the manager.
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}

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
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import StorefrontIcon from '@mui/icons-material/Storefront';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { friendlyDbError } from '../lib/format';

type Mode = 'choose' | 'create' | 'join-code' | 'join-confirm';

interface InvitationPreview {
  workspace_name: string;
  inviter_name: string;
  expires_at: string;
  target_email: string | null;
}

export default function SetupPage() {
  const { session, staff, workspace, loading, refreshWorkspace, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('choose');
  const [workspaceName, setWorkspaceName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // The join path now requires a manager-issued code, so there is nothing to
    // probe up front.
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

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim().length === 0) {
      setError('Please enter your invitation code.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc('preview_invitation', {
      p_code: inviteCode.trim(),
    });
    setSubmitting(false);
    if (rpcError) {
      setError('That code is not valid, has expired, or has already been used. Ask your manager for a new one.');
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.workspace_name) {
      setError('That code is not valid, has expired, or has already been used. Ask your manager for a new one.');
      return;
    }
    setPreview(row as InvitationPreview);
    setMode('join-confirm');
  };

  const onJoin = async () => {
    if (!preview) return;
    const v = validate(false);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('redeem_invitation', {
      p_code: inviteCode.trim(),
      p_display_name: displayName.trim(),
    });
    setSubmitting(false);
    if (rpcError) {
      setError(friendlyDbError(rpcError.message));
      return;
    }
    await refreshWorkspace();
    navigate('/', { replace: true });
  };

  const backToChoose = () => {
    setMode('choose');
    setError(null);
    setPreview(null);
    setInviteCode('');
  };

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 440, p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              Set up your workspace
            </Typography>
          </Box>
          <Tooltip title={`Signed in as ${session?.user.email ?? ''}. Click to sign out`}>
            <IconButton onClick={() => void signOut()} size="small" aria-label="Sign out">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
          Signed in as {session?.user.email ?? ''}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {mode === 'choose'
            ? 'Create a workspace of your own, or join one your manager invited you to.'
            : mode === 'create'
              ? 'You will be the manager of this workspace.'
              : mode === 'join-code'
                ? 'Enter the invitation code your manager shared with you.'
                : 'Check where you are joining before you confirm.'}
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
              Create a workspace
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<GroupAddIcon />}
              onClick={() => setMode('join-code')}
              sx={{ py: 2 }}
            >
              Join with an invitation code
            </Button>
          </Box>
        )}

        {mode === 'create' && (
          <Box component="form" onSubmit={onCreate} noValidate>
            <TextField
              label="Workspace name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              fullWidth
              margin="normal"
              required
              placeholder="e.g. Corner Bakery on Main St."
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Creating a workspace makes you its manager. You can invite staff from Staff and settings.
            </Typography>
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
            <Button variant="text" fullWidth onClick={backToChoose} sx={{ mt: 1 }}>
              Back
            </Button>
          </Box>
        )}

        {mode === 'join-code' && (
          <Box component="form" onSubmit={onPreview} noValidate>
            <TextField
              label="Invitation code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              fullWidth
              margin="normal"
              required
              placeholder="e.g. 9f2c…"
              helperText="Your manager shares this code from their Staff and settings page."
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
              {submitting ? 'Checking…' : 'Check code'}
            </Button>
            <Button variant="text" fullWidth onClick={backToChoose} sx={{ mt: 1 }}>
              Back
            </Button>
          </Box>
        )}

        {mode === 'join-confirm' && preview && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              You are joining <strong>{preview.workspace_name}</strong>
              {preview.inviter_name ? <>, invited by {preview.inviter_name}</> : null}.
              Joining gives you the staff role.
            </Alert>
            {preview.target_email && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                This invitation was sent to <strong>{preview.target_email}</strong>. If that is not the email you signed up with, ask your manager for a new invitation.
              </Typography>
            )}
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
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              onClick={() => void onJoin()}
              sx={{ mt: 2 }}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {submitting ? 'Joining…' : `Join ${preview.workspace_name}`}
            </Button>
            <Button variant="text" fullWidth onClick={backToChoose} sx={{ mt: 1 }}>
              Back
            </Button>
          </Box>
        )}

        {mode === 'choose' && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
              Workspaces are private. You can only join one that has invited you with a valid code. Knowing a workspace's name is not enough.
            </Typography>
            <Button variant="text" fullWidth startIcon={<LogoutIcon />} onClick={() => void signOut()} sx={{ mt: 2 }}>
              Sign out
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}

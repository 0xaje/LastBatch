import { useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import { supabase } from '../lib/supabase';
import PasswordInput from '../components/PasswordInput';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // Supabase JS exchanges the ?code= from the recovery link automatically.
      // Give that exchange a moment to settle before deciding the link is bad.
      await new Promise((r) => setTimeout(r, 1500));
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasRecoverySession(Boolean(data.session));
      setChecking(false);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('same as') || err.message.toLowerCase().includes('different')
          ? 'Choose a password different from the current one.'
          : 'We could not update the password. Please try again.'
      );
      return;
    }
    setDone(true);
  };

  if (checking) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 420, p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {done ? 'Password updated' : 'Choose a new password'}
          </Typography>
        </Box>

        {!hasRecoverySession && !done ? (
          <>
            <Alert severity="error" sx={{ mt: 2 }}>
              This reset link is invalid or has expired. Request a new one.
            </Alert>
            <Button variant="contained" fullWidth size="large" sx={{ mt: 3 }} onClick={() => navigate('/forgot-password')}>
              Request a new reset link
            </Button>
          </>
        ) : done ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Your password has been updated. Sign in with your new password.
            </Typography>
            <Button variant="contained" fullWidth size="large" sx={{ mt: 3 }} onClick={() => navigate('/sign-in')}>
              Go to sign in
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Pick a new password for your LastBatch account.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={onSubmit} noValidate>
              <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" helperText="At least 6 characters" />
              <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={submitting}
                sx={{ mt: 2 }}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {submitting ? 'Updating…' : 'Update password'}
              </Button>
            </Box>
          </>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          <RouterLink to="/sign-in" style={{ color: 'var(--mui-palette-primary-main)', fontWeight: 600 }}>
            Back to sign in
          </RouterLink>
        </Typography>
      </Paper>
    </Box>
  );
}

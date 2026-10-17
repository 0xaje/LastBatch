import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import { supabase } from '../lib/supabase';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('rate limit')
          ? 'Too many reset emails were requested. Please wait a minute and try again.'
          : 'We could not send a reset email. Please check the address and try again.'
      );
      return;
    }
    setSent(true);
  };

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 420, p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Reset your password
          </Typography>
        </Box>

        {sent ? (
          <>
            <Alert severity="success" sx={{ mt: 2 }}>
              Reset email sent to {email.trim()}.
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Open the link in the email to choose a new password. If it does not arrive within a few minutes, check your spam folder.
            </Typography>
            <Button variant="outlined" fullWidth size="large" sx={{ mt: 3 }} onClick={() => navigate('/sign-in')}>
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the email on your account and we will send you a link to set a new password.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={onSubmit} noValidate>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                autoComplete="email"
                margin="normal"
                required
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
                {submitting ? 'Sending…' : 'Send reset link'}
              </Button>
            </Box>
          </>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          Remembered it?{' '}
          <RouterLink to="/sign-in" style={{ color: 'var(--mui-palette-primary-main)', fontWeight: 600 }}>
            Sign in
          </RouterLink>
        </Typography>
      </Paper>
    </Box>
  );
}

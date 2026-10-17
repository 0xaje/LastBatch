import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
      <CircularProgress size={32} sx={{ color: 'primary.main' }} />
    </Box>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 4,
        textAlign: 'center',
        borderStyle: 'dashed',
        bgcolor: 'transparent',
        borderColor: 'divider',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 2 : 0 }}>
        {description}
      </Typography>
      {action}
    </Paper>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        textAlign: 'center',
        borderColor: 'error.light',
        bgcolor: 'transparent',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'error.main', mb: 0.5 }}>
        Something went wrong
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: onRetry ? 2 : 0 }}>
        {message ?? 'Could not load this data. Please try again.'}
      </Typography>
      {onRetry && (
        <Button size="small" variant="outlined" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Paper>
  );
}

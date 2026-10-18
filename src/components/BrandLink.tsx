import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';

export default function BrandLink() {
  return (
    <Box
      component={RouterLink}
      to="/"
      aria-label="Back to LastBatch home"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1, textDecoration: 'none', '&:hover': { opacity: 0.85 } }}
    >
      <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 32 }} />
      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
        LastBatch
      </Typography>
    </Box>
  );
}

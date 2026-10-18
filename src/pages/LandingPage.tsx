import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import FactoryIcon from '@mui/icons-material/Factory';
import RuleIcon from '@mui/icons-material/Rule';
import HandshakeIcon from '@mui/icons-material/Handshake';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ThemeToggle from '../components/ThemeToggle';

const PILLARS = [
  {
    icon: <FactoryIcon />,
    title: 'Record operational activity',
    body: 'Every production batch, replenishment and waste event is logged as it happens — with who did it, when, and how much.',
  },
  {
    icon: <RuleIcon />,
    title: 'Reconcile quantities and discrepancies',
    body: 'At close of shift, counted stock is compared against what was produced, replenished and wasted, so gaps are explained in writing rather than guessed.',
  },
  {
    icon: <HandshakeIcon />,
    title: 'Hand over responsibilities',
    body: 'Shift closeouts and handover notes are acknowledged by the next person, so nothing falls through between shifts.',
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Set up your catalogue',
    body: 'Create a workspace and list the items you bake — with their units. Managers invite staff with a single-use code.',
  },
  {
    step: '2',
    title: 'Log activity during the shift',
    body: 'Batches as they leave the oven, replenishments to the counter, and waste as it happens — each entry recorded with a time and a name.',
  },
  {
    step: '3',
    title: 'Count and close the shift',
    body: 'Count what is left. LastBatch compares it against production, replenishment and waste, and flags anything unaccounted for.',
  },
  {
    step: '4',
    title: 'Hand over with confidence',
    body: 'Write a handover note, and the next shift acknowledges it. The closeout record keeps the numbers and explanations on file.',
  },
];

export default function LandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* Nav */}
      <AppBar position="sticky" sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1, px: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              LastBatch
            </Typography>
          </Box>
          <ThemeToggle />
          {isMobile ? (
            <>
              <IconButton aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((v) => !v)} size="small">
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </IconButton>
              {menuOpen && (
                <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button component={RouterLink} to="/sign-in">Sign in</Button>
                  <Button component={RouterLink} to="/sign-up" variant="contained">Get started</Button>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button component={RouterLink} to="/sign-in">Sign in</Button>
              <Button component={RouterLink} to="/sign-up" variant="contained">Get started</Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Hero */}
      <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 10 } }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.08em' }}>
          For bakeries and cafés
        </Typography>
        <Typography
          variant="h2"
          component="h1"
          sx={{
            fontWeight: 800,
            letterSpacing: '-0.03em',
            fontSize: { xs: '2.4rem', sm: '3rem', md: '3.6rem' },
            lineHeight: 1.1,
            mb: 2,
          }}
        >
          Know exactly what left your kitchen — and where it went.
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 640, mb: 4 }}>
          LastBatch tracks production batches, replenishments and waste as they happen, reconciles them against counted stock at close of shift, and hands the numbers over with the shift.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 6 }}>
          <Button component={RouterLink} to="/sign-up" variant="contained" size="large" sx={{ px: 4 }}>
            Get started
          </Button>
          <Button variant="outlined" size="large" href="#how-it-works" sx={{ px: 3 }}>
            See how it works
          </Button>
          <Button component={RouterLink} to="/sign-in" variant="text" size="large">
            Sign in
          </Button>
        </Box>
        {/* Product preview — an illustration of the shift closeout screen, with sample values */}
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            bgcolor: 'background.paper',
            borderColor: 'divider',
            maxWidth: 560,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Shift closeout
            </Typography>
            <Chip label="Sample view" size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, mb: 2 }}>
            <Typography variant="body2">Croissants</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', textAlign: 'right' }}>
              48 baked · 11 left
            </Typography>
            <Typography variant="body2">Sourdough loaf</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', textAlign: 'right' }}>
              20 baked · 2 left
            </Typography>
            <Typography variant="body2">Cinnamon roll</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', textAlign: 'right' }}>
              36 baked · 0 left
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            At close of shift each item is counted and reconciled against what was produced, replenished and wasted — with a written explanation for any difference.
          </Typography>
        </Paper>
      </Container>

      {/* Problem */}
      <Box sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 } }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}>
            The problem
          </Typography>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 2 }}>
            Unsold baked goods are only visible when someone counts them.
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 640 }}>
            In a busy bakery, trays leave the oven, items move to the counter, some are sold, some are given away, some go stale. At the end of the day the numbers rarely agree — and without a written record of what was produced, moved, thrown away and counted, nobody can say why.
          </Typography>
        </Container>
      </Box>

      {/* Pillars */}
      <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 6, md: 8 } }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 3 }}>
          Three things LastBatch does
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          {PILLARS.map((p) => (
            <Paper
              key={p.title}
              variant="outlined"
              sx={{ p: 3, bgcolor: 'background.paper', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}
            >
              <Box sx={{ color: 'primary.main', display: 'flex' }}>{p.icon}</Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {p.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {p.body}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Container>

      {/* How it works */}
      <Box id="how-it-works" sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 } }}>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 3 }}>
            How it works
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {STEPS.map((s) => (
              <Paper key={s.step} variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {s.step}
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {s.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {s.body}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', py: 4, mt: 'auto' }}>
        <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 22 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              LastBatch
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Production, waste and shift tracking for bakeries and cafés.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} LastBatch
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

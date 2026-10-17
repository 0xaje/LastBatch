import { useColorScheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

export default function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const active = mode === 'system' ? (systemMode ?? 'light') : (mode ?? 'light');
  const isDark = active === 'dark';
  return (
    <Tooltip title={isDark ? 'Switch to day mode' : 'Switch to night mode'}>
      <IconButton
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        size="small"
        aria-label="Toggle day and night mode"
      >
        {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

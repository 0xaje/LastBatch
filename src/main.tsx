import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

// Inter font
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

// Apply the saved theme before React mounts to avoid a flash of the wrong theme.
// Reads the same localStorage key MUI's ThemeProvider persists setMode() under.
(function applyInitialTheme() {
  try {
    const saved = localStorage.getItem('mui-mode');
    const mode =
      saved === 'light' || saved === 'dark'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.style.colorScheme = mode;
  } catch {
    /* ignore */
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme} defaultMode="system" noSsr>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#174F3D',
      light: '#2E6B54',
      dark: '#0E3A2C',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#E9A23B',
      light: '#F2BC6B',
      dark: '#C4822A',
      contrastText: '#202B27',
    },
    background: {
      default: '#F8F6F0',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#202B27',
      secondary: '#5C6B64',
    },
    success: {
      main: '#25855A',
      light: '#3FA476',
      dark: '#1B6243',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#C94949',
      light: '#DA7070',
      dark: '#A33838',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#C4822A',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#174F3D',
      contrastText: '#FFFFFF',
    },
    divider: '#E4E0D5',
    grey: {
      50: '#FAF9F5',
      100: '#F1EEE5',
      200: '#E4E0D5',
      300: '#CFC9B8',
      400: '#A8A396',
      500: '#7C776B',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    subtitle2: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
        sizeLarge: {
          padding: '12px 22px',
          fontSize: '1rem',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #E4E0D5',
          borderRadius: 14,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'inherit',
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderTop: '1px solid #E4E0D5',
          backgroundColor: '#FFFFFF',
        },
      },
    },
  },
});

export default theme;

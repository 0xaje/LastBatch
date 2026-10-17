import { createTheme } from '@mui/material/styles';

// Pokter-inspired palette
// Light: warm editorial daylight. Dark: refined, comfortable night.
const light = {
  palette: {
    primary: {
      main: '#1D7446',
      light: '#2E8A57',
      dark: '#145A35',
      contrastText: '#F3F1EB',
    },
    secondary: {
      main: '#F0B90B',
      light: '#F4C93F',
      dark: '#C29609',
      contrastText: '#16171A',
    },
    background: {
      default: '#FBFAF6',
      paper: '#EAE7DF',
    },
    text: {
      primary: '#16171A',
      secondary: '#48494D',
    },
    success: {
      main: '#1D7446',
      light: '#2E8A57',
      dark: '#145A35',
      contrastText: '#F3F1EB',
    },
    error: {
      main: '#B3423A',
      light: '#C95F58',
      dark: '#8E332D',
      contrastText: '#F3F1EB',
    },
    warning: {
      main: '#C29609',
      light: '#D8AC2B',
      dark: '#9A7606',
      contrastText: '#16171A',
    },
    info: {
      main: '#1D7446',
      light: '#2E8A57',
      dark: '#145A35',
      contrastText: '#F3F1EB',
    },
    divider: '#DCD8CD',
    grey: {
      50: '#F7F6F1',
      100: '#EAE7DF',
      200: '#DCD8CD',
      300: '#BFBAAD',
      400: '#A6A397',
      500: '#66665F',
      600: '#48494D',
      700: '#2B2C2F',
    },
  },
};

const dark = {
  palette: {
    primary: {
      main: '#F0B90B',
      light: '#F4C93F',
      dark: '#C29609',
      contrastText: '#16171A',
    },
    secondary: {
      main: '#2E8A57',
      light: '#3F9E69',
      dark: '#1D7446',
      contrastText: '#F3F1EB',
    },
    background: {
      default: '#16171A',
      paper: '#292B30',
    },
    text: {
      primary: '#F3F1EB',
      secondary: '#BFBAAD',
    },
    success: {
      main: '#2E8A57',
      light: '#3F9E69',
      dark: '#1D7446',
      contrastText: '#F3F1EB',
    },
    error: {
      main: '#E06A5F',
      light: '#EA887E',
      dark: '#C4514A',
      contrastText: '#16171A',
    },
    warning: {
      main: '#F0B90B',
      light: '#F4C93F',
      dark: '#C29609',
      contrastText: '#16171A',
    },
    info: {
      main: '#2E8A57',
      light: '#3F9E69',
      dark: '#1D7446',
      contrastText: '#F3F1EB',
    },
    divider: '#48494D',
    grey: {
      50: '#34363B',
      100: '#292B30',
      200: '#24262A',
      300: '#48494D',
      400: '#66665F',
      500: '#A6A397',
      600: '#BFBAAD',
      700: '#F3F1EB',
    },
  },
};

const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: { light, dark },
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
        root: ({ theme }) => ({
          border: `1px solid ${theme.vars.palette.divider}`,
          borderRadius: 14,
        }),
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
        root: ({ theme }) => ({
          borderTop: `1px solid ${theme.vars.palette.divider}`,
          backgroundColor: theme.vars.palette.background.default,
        }),
      },
    },
  },
});

export default theme;

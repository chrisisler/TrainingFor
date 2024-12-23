import { CssBaseline, useMediaQuery } from '@mui/material';
import { createTheme, darken, ThemeProvider } from '@mui/material/styles';
import { FC, ReactNode } from 'react';

declare module '@mui/material/styles' {
  interface Theme {
    make: {
      background(color1: string, color2: string): string;
    };
  }
  interface ThemeOptions {
    make: {
      background(color1: string, color2: string): string;
    };
  }
}

export const PrivateThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const prefersDark = useMediaQuery('@media (prefers-color-scheme: dark)');

  const theme = createTheme({
    palette: {
      mode: prefersDark ? 'dark' : 'light',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiSwipeableDrawer: {
        defaultProps: {
          PaperProps: {
            sx: {
              padding: theme => theme.spacing(3, 2, 2, 2),
              maxWidth: '700px',
              margin: '0 auto',
              backgroundColor: theme =>
                darken(theme.palette.background.default, prefersDark ? 1.0 : 0.03),
              boxShadow: 'none',
            },
          },
        },
      },
      MuiCollapse: {
        defaultProps: {
          mountOnEnter: true,
          unmountOnExit: true,
        },
      },
    },
    make: {
      background(color1: string, color2: string): string {
        return `linear-gradient(60deg, ${color1} 35%, ${color2} 95%)`;
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

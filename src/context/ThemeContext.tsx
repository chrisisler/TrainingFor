import { CssBaseline, useMediaQuery } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
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
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true,
          disableTouchRipple: true,
        },
      },
      MuiSwipeableDrawer: {
        defaultProps: {
          PaperProps: {
            sx: {
              padding: theme => theme.spacing(3, 3),
              maxWidth: theme => theme.breakpoints.values.sm,
              margin: '0 auto',
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

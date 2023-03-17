import { CssBaseline, useMediaQuery } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { FC, ReactNode } from 'react';

declare module '@mui/material/styles' {
  interface Theme {}
  // allow configuration using `createTheme`
  interface ThemeOptions {}
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
            sx: { padding: theme => theme.spacing(4, 3) },
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
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

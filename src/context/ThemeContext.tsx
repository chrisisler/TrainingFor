import { CssBaseline, useMediaQuery } from '@mui/material';
import { createTheme, darken, ThemeProvider } from '@mui/material/styles';
import { FC, ReactNode, useEffect } from 'react';

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

  useEffect(() => {
    setAppleStatusBarStyle(prefersDark ? 'black-translucent' : 'default');
  }, [prefersDark])

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

function setAppleStatusBarStyle(style: 'default' | 'black' | 'black-translucent') {
  let metaTag: null | HTMLMetaElement =
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.name = "apple-mobile-web-app-status-bar-style";
    document.head.appendChild(metaTag);
  }

  // Set or update the content attribute
  metaTag.content = style;
}


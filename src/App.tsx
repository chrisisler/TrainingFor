import { Box, Collapse, Typography } from '@mui/material';
// import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SnackbarProvider } from 'notistack';
import { FC } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { PrivateThemeProvider, UserProvider } from './context';
import { Authentication, Home, Editor, Programs } from './pages';
import { DataStateView, Paths } from './util';
import { useAuthStore } from './api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      cacheTime: 1000 * 60 * 60 * 24 * 2, // 2 days
    },
  },
});

// const persister = createSyncStoragePersister({ storage: window.localStorage });

export const App: FC = () => {
  const authState = useAuthStore(store => store.authState);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <BrowserRouter>
        <SnackbarProvider
          dense
          preventDuplicate
          maxSnack={2}
          autoHideDuration={3500}
          TransitionComponent={Collapse}
        >
          <PrivateThemeProvider>
            <DataStateView
              data={authState}
              loading={() => (
                <Box
                  sx={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="overline" fontStyle="italic">
                    Trainquil
                  </Typography>
                </Box>
              )}
              empty={() => (
                <Routes>
                  <Route path="/" element={<Authentication />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              )}
            >
              {user => (
                <UserProvider user={user}>
                  <QueryClientProvider client={queryClient}>
                    <Routes>
                      <Route path={Paths.home} element={<Home />} />
                      <Route path={Paths.editor()} element={<Editor />} />
                      <Route path={Paths.program()} element={<Programs />} />
                      <Route path="*" element={<Navigate to={Paths.home} />} />
                    </Routes>
                  </QueryClientProvider>
                </UserProvider>
              )}
            </DataStateView>
          </PrivateThemeProvider>
        </SnackbarProvider>
      </BrowserRouter>
    </Box>
  );
};

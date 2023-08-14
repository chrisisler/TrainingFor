import { Box, Collapse } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { FC } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { PrivateThemeProvider, UserProvider } from './context';
import { Authentication, Home, Editor, Programs } from './pages';
import { DataStateView, Paths, useUserAuthSubscription } from './util';

const queryClient = new QueryClient();

export const App: FC = () => {
  /** When this value is DataState.Empty, the user is not authenticated. */
  const [authState] = useUserAuthSubscription();

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
                      <Route path={Paths.program} element={<Programs />} />
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

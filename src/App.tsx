import { Box, Collapse } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { FC } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { PrivateThemeProvider, UserProvider } from './context';
import { Authentication, Account, Editor, Programs } from './pages';
import { DataStateView, Paths, useUserAuthSubscription } from './util';

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
                  <Routes>
                    <Route path={Paths.account} element={<Account />} />
                    <Route path={Paths.editor()} element={<Editor />} />
                    <Route path={Paths.program} element={<Programs />} />
                    <Route path="*" element={<Navigate to={Paths.account} />} />
                  </Routes>
                </UserProvider>
              )}
            </DataStateView>
          </PrivateThemeProvider>
        </SnackbarProvider>
      </BrowserRouter>
    </Box>
  );
};

import { Box } from '@mui/material';
import { User } from 'firebase/auth';
import { SnackbarProvider } from 'notistack';
import { FC } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { PrivateThemeProvider, UserProvider } from './context';
import { Authentication, Account, Editor } from './pages';
import { DataState, DataStateView, Paths, useUserAuthSubscription } from './util';

// import logo from "./logo.svg";

export const App: FC = () => {
  /** When this value is DataState.Empty, the user is not authenticated. */
  const authState: DataState<User> = useUserAuthSubscription();

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <BrowserRouter>
        <SnackbarProvider maxSnack={3} dense autoHideDuration={2500}>
          <PrivateThemeProvider>
            <DataStateView
              data={authState}
              empty={() => (
                <Routes>
                  <Route path="/" element={<Authentication />} />
                  {/** TODO Ensure navigation to non-legit URLs redirects to Authentication */}
                </Routes>
              )}
            >
              {user => (
                <UserProvider user={user}>
                  <Routes>
                    <Route path={Paths.account} element={<Account />} />
                    <Route path={Paths.editor()} element={<Editor />} />
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

import { Box, Collapse, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { FC, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { PrivateThemeProvider, UserProvider } from './context';
import { Authentication, Editor, Programs } from './pages';
import { DataState, DataStateView, Paths, useToast } from './util';
import { useAuthStore, useStore } from './api';
import { TrainingLog } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      cacheTime: 1000 * 60 * 60 * 24 * 2, // 2 days
    },
  },
});

export const App: FC = () => {
  const authState = useAuthStore(store => store.authState);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <BrowserRouter>
        <SnackbarProvider
          dense
          preventDuplicate
          maxSnack={2}
          autoHideDuration={3200}
          TransitionComponent={Collapse}
        >
          <PrivateThemeProvider>
            <DataStateView
              data={authState}
              loading={AppLoading}
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
                      <Route path={Paths.editor()} element={<Editor />} />
                      <Route path={Paths.program()} element={<Programs />} />
                      <Route path="*" element={<EditorLastOrNew />} />
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

/** Navigate to last training log or create one. */
function EditorLastOrNew() {
  const toast = useToast();
  const logs = useStore(store => store.logs);
  const authState = useAuthStore(store => store.authState);
  const TrainingLogsAPI = useStore(store => store.TrainingLogsAPI);

  const [log, setLog] = useState<DataState<TrainingLog>>(DataState.Loading);

  useEffect(() => {
    if (!DataState.isReady(logs)) {
      return;
    }

    if (logs.length) {
      return setLog(logs[0]);
    }

    if (!DataState.isReady(authState)) {
      toast.error('No user logged in');
      return;
    }

    TrainingLogsAPI
      .create({
        timestamp: Date.now(),
        authorUserId: authState.uid,
        bodyweight: 0,
        isFinished: false,
        note: '',
        programId: null,
        programLogTemplateId: null,
      })
      .then((created: TrainingLog) => {
        setLog(created);
      })
      .catch(err => {
        setLog(DataState.error(err.message));
        console.error(err.message);
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, authState]);

  return (
    <DataStateView data={log} loading={AppLoading}>
      {log => <Navigate to={Paths.editor(log.id, TrainingLog.title(log))} />}
    </DataStateView>
  );
}

function AppLoading() {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography variant="overline" fontWeight={600}>
        Trainquil
      </Typography>
    </Box>
  );
}

import { Add, ChevronRightTwoTone, Logout } from '@mui/icons-material';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { signOut } from 'firebase/auth';
import { limit, orderBy } from 'firebase/firestore';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { API, auth } from '../api';
import { useUser } from '../context';
import { TrainingLog } from '../types';
import { DataStateView, Paths, useDataState, useToast } from '../util';

export const Account: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();

  const [logs] = useDataState(
    () => API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(20)),
    [user.uid]
  );

  const startNewTrainingLog = useCallback(async () => {
    try {
      const entry: TrainingLog = await API.TrainingLogs.create({
        timestamp: Date.now(),
        authorUserId: user.uid,
        id: '',
      });
      navigate(Paths.editor(entry.id));
      toast.success('Training log created successfully.');
    } catch (err) {
      toast.error(err.message);
    }
  }, [user.uid, navigate, toast]);

  const deauthenticate = useCallback(async () => {
    if (!window.confirm('Sign out?')) return;
    try {
      await signOut(auth);
      toast.success('Signed out.');
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        padding: theme => theme.spacing(2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between">
        <Typography variant="overline">Account Page</Typography>
        <IconButton size="small" onClick={deauthenticate}>
          <Logout fontSize="small" />
        </IconButton>
      </Box>

      {/** Account button */}

      <Button
        fullWidth
        size="large"
        variant="contained"
        startIcon={<Add />}
        onClick={startNewTrainingLog}
      >
        Log
      </Button>

      <DataStateView data={logs}>
        {logs => (
          <Stack spacing={2} sx={{ padding: theme => theme.spacing(3, 2) }}>
            {logs.map(log => (
              <Box
                key={log.id}
                sx={{
                  // color: theme => theme.palette.text.primary,
                  borderBottom: theme => `1px solid ${theme.palette.divider}`,
                  // borderLeft: theme => `3px solid ${theme.palette.divider}`,
                  // borderRadius: 0,
                  // textTransform: 'none',
                  // textAlign: 'left',
                  padding: theme => theme.spacing(1, 2),
                }}
                onClick={() => navigate(Paths.editor(log.id))}
                display="flex"
                justifyContent="space-between"
              >
                <Stack>
                  <Typography>{new Date(log.timestamp).toLocaleString()}</Typography>
                  <Typography color="textSecondary">
                    {formatDistanceToNowStrict(new Date(log.timestamp), { addSuffix: true })}
                  </Typography>
                </Stack>
                <ChevronRightTwoTone sx={{ color: 'text.secondary' }} />
              </Box>
            ))}
          </Stack>
        )}
      </DataStateView>
    </Box>
  );
};

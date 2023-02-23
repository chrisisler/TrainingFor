import { Add, ChevronRightTwoTone, Google, Launch, Logout } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Stack,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { signOut } from 'firebase/auth';
import { limit, orderBy, } from 'firebase/firestore';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { API, auth, Authenticate } from '../api';
import { useUser } from '../context';
import { TrainingLog } from '../types';
import { DataState, DataStateView, Paths, useDataState, useMaterialMenu, useToast } from '../util';

export const Account: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const reauthDrawer = useMaterialMenu();

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
    <Stack
      spacing={3}
      sx={{
        height: '100%',
        width: '100%',
        padding: theme => theme.spacing(2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between">
        <Typography variant="overline">
          Account Page:{' '}
          {user.isAnonymous ? 'Anonymous' : user.displayName || user.providerData[0]?.displayName}
        </Typography>
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
        // sx={{ marginTop: theme => theme.spacing(3) }}
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

      {/** Button to reassign data from current anon user to google auth'd account */}
      {DataState.isReady(logs) && logs.length > 0 && (
        <>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            endIcon={<Logout />}
            onClick={reauthDrawer.onOpen}
          >
            Create Persistent Account
          </Button>

          <SwipeableDrawer {...reauthDrawer} anchor="bottom">
            <Collapse in={reauthDrawer.open}>
              <Stack spacing={5} sx={{ padding: theme => theme.spacing(3, 1), height: '70vh' }}>
                <Typography variant="h6" color="textSecondary">
                  Anonymous accounts are for temporary usage.
                  <br />
                  <br />
                  Re-create this account (using Google sign-in) to persist your training across
                  sessions?
                  <br />
                  <br />
                  All data will be copied over.
                </Typography>
                <Button
                  fullWidth
                  size="large"
                  variant="outlined"
                  startIcon={<Google />}
                  endIcon={<Launch />}
                  onClick={async () => {
                    if (!window.confirm('Are you sure?')) return;
                    try {
                      const credential = await Authenticate.withGoogle();
                      if (!credential) throw Error('Authentication failed - user not found.');
                      await API.assignAnonymousDataToGoogleUser(user.uid, credential.user.uid);
                      toast.success('Assigned data to persistent account.');
                    } catch (error) {
                      toast.error(error.message);
                    }
                  }}
                >
                  Sign In With Google
                </Button>
              </Stack>
            </Collapse>
          </SwipeableDrawer>
        </>
      )}
    </Stack>
  );
};

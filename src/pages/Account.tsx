import {
  ChevronRightTwoTone,
  CreateOutlined,
  Google,
  Launch,
  Logout,
  ShortTextRounded,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  Fab,
  IconButton,
  Stack,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { signOut } from 'firebase/auth';
import { limit, orderBy, where } from 'firebase/firestore';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { API, auth, Authenticate } from '../api';
import { useUser } from '../context';
import { Movement, TrainingLog } from '../types';
import {
  DataState,
  DataStateView,
  Months,
  Paths,
  useDataState,
  useMaterialMenu,
  useToast,
} from '../util';

export const Account: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const reauthDrawer = useMaterialMenu();

  // A subset of the users logs to display in detail
  const [logs] = useDataState(
    () => API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(5)),
    [user.uid]
  );

  const [movementsByLogId] = useDataState(async () => {
    if (!DataState.isReady(logs)) {
      return logs;
    }
    const promises = logs.map(_ => API.Movements.getAll(where('logId', '==', _.id)));
    const movementLists = await Promise.all(promises);
    const movementsByLogId = new Map<string, Movement[]>(logs.map(_ => [_.id, []]));
    movementLists.forEach(movementList => {
      movementList.forEach(m => {
        movementsByLogId.get(m.logId)?.push(m);
      });
    });
    return movementsByLogId;
  }, [logs]);

  const startNewTrainingLog = useCallback(async () => {
    try {
      const entry: TrainingLog = await API.TrainingLogs.create({
        timestamp: Date.now(),
        authorUserId: user.uid,
        bodyweight: 0,
        id: '',
      });
      navigate(Paths.editor(entry.id));
      toast.success('Created new training page.');
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
        height: '100vh',
        width: '100vw',
        padding: theme => theme.spacing(2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between">
        <Typography variant="overline" color="textSecondary">
          {user.isAnonymous ? 'Anonymous' : user.displayName || user.providerData[0]?.displayName}
        </Typography>
        <IconButton size="small" onClick={deauthenticate}>
          <Logout fontSize="small" />
        </IconButton>
      </Box>

      {/** Count of unique saved movements */}
      {/** Count of training logs */}
      {/** Count of total volume */}

      <DataStateView data={logs}>
        {logs =>
          logs.length === 0 ? (
            <Typography sx={{ textAlign: 'center' }} color="textSecondary">
              No training data.
            </Typography>
          ) : (
            <Stack spacing={2} sx={{ padding: theme => theme.spacing(3, 2) }}>
              {logs.map(log => {
                const date = new Date(log.timestamp);
                return (
                  <Box
                    key={log.id}
                    sx={{
                      border: theme => `1px solid ${theme.palette.divider}`,
                      borderRadius: 2,
                      padding: theme => theme.spacing(2, 3),
                    }}
                    onClick={() => navigate(Paths.editor(log.id))}
                    display="flex"
                    justifyContent="space-between"
                  >
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        spacing={2}
                        alignItems="baseline"
                        sx={{ borderBottom: theme => `1px solid ${theme.palette.divider}` }}
                      >
                        <Typography>
                          {Months[date.getMonth()].slice(0, 3) + ' ' + date.getDate()}
                        </Typography>
                        <Typography color="textSecondary" variant="subtitle2">
                          {formatDistanceToNowStrict(new Date(log.timestamp), { addSuffix: true })}
                        </Typography>
                      </Stack>
                      <DataStateView data={DataState.map(movementsByLogId, _ => _.get(log.id))}>
                        {movements =>
                          !movements?.length ? (
                            <Typography sx={{ color: 'text.secondary' }} variant="overline">
                              No movements
                            </Typography>
                          ) : (
                            <Stack>
                              {movements.map(movement => (
                                <Typography variant="body1"> {movement.name} </Typography>
                              ))}
                            </Stack>
                          )
                        }
                      </DataStateView>
                    </Stack>
                    <ChevronRightTwoTone sx={{ color: 'text.secondary' }} fontSize="small" />
                  </Box>
                );
              })}
            </Stack>
          )
        }
      </DataStateView>

      <Box
        display="flex"
        sx={{ width: '100%', height: '100%', alignItems: 'end', justifyContent: 'center' }}
      >
        <Fab
          variant="extended"
          onClick={startNewTrainingLog}
          sx={{ width: '100%' }}
          color="primary"
        >
          <ShortTextRounded sx={{ mr: -1 }} fontSize="large" />
          <CreateOutlined fontSize="large" />
        </Fab>
      </Box>

      {/** Button to reassign data from current anon user to google auth'd account */}
      {user.isAnonymous && DataState.isReady(logs) && logs.length > 0 && (
        <>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            endIcon={<Logout />}
            onClick={reauthDrawer.onOpen}
          >
            Persist Account
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
                      if (!credential) throw Error('Cannot authenticate: user not found.');
                      await API.assignAnonymousDataToGoogleUser(user.uid, credential.user.uid);
                      toast.success('Assigned data to new persistent account.');
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

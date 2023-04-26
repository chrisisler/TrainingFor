import { uuidv4 } from '@firebase/util';
import {
  AddCircleOutlineRounded,
  AddRounded,
  Google,
  Launch,
  Logout,
  NavigateNextRounded,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Paper,
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
import {
  DataState,
  DataStateView,
  Months,
  Paths,
  SORTED_WEEKDAYS,
  useActiveProgram,
  useDataState,
  useMaterialMenu,
  useToast,
} from '../util';
import { Movement } from '../types';

export const Home: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const reauthDrawer = useMaterialMenu();
  const programTrainingMenu = useMaterialMenu();

  // Get active program (if it exists for auth'd user) to display upcoming
  // training AND power the create training log from active program button.
  const [activeProgram] = useActiveProgram();

  // A subset of the users logs to display in detail
  const [logs] = useDataState(
    () => API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(20)),
    [user.uid]
  );

  const [movementsByLogId] = useDataState<Map<string, Movement[]>>(async () => {
    if (!DataState.isReady(logs)) {
      return logs;
    }
    const promises = logs.map(_ =>
      API.Movements.getAll(where('logId', '==', _.id), orderBy('position', 'asc'))
    );
    const movementLists = await Promise.all(promises);
    const movementsByLogId = new Map<string, Movement[]>(logs.map(_ => [_.id, []]));
    movementLists.forEach(movementList => {
      movementList.forEach(m => {
        movementsByLogId.get(m.logId)?.push(m);
      });
    });
    return movementsByLogId;
  }, [logs]);

  const createTrainingLog = useCallback(
    async ({ fromTemplateId }: { fromTemplateId: string | null }) => {
      try {
        const programId = !!fromTemplateId && DataState.isReady(activeProgram) && activeProgram.id;
        const newTrainingLog = await API.TrainingLogs.create({
          timestamp: Date.now(),
          authorUserId: user.uid,
          bodyweight: 0,
          isFinished: false,
          note: '',
          programId: programId || null,
          programLogTemplateId: fromTemplateId || null,
        });
        // Copy over movements from the program log template to the log
        const logIsCreatedFromProgramTemplate = !!fromTemplateId;
        if (logIsCreatedFromProgramTemplate) {
          const programMovements = await API.ProgramMovements.getAll(
            where('logId', '==', fromTemplateId)
          );
          const logMovements: Movement[] = programMovements.map(movement => ({
            ...movement,
            logId: newTrainingLog.id,
            sets: movement.sets.map(s => ({ ...s, uuid: uuidv4() })),
            timestamp: Date.now(),
          }));
          await Promise.all([
            // Create movements in the new log
            API.Movements.createMany(logMovements),
            // Update lastSeen property for each movement's savedMovement parent
            logMovements.map(_ =>
              API.SavedMovements.update({ id: _.savedMovementId, lastSeen: _.timestamp })
            ),
          ]);
        }
        navigate(Paths.editor(newTrainingLog.id));
        toast.success(`Created new training page.`);
      } catch (err) {
        toast.error(err.message);
      }
    },
    [activeProgram, user.uid, navigate, toast]
  );

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
      spacing={2}
      sx={{
        height: '100vh',
        width: '100vw',
        padding: theme => theme.spacing(2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between" alignItems="baseline">
        <Button onClick={() => navigate(Paths.program)} variant="text" size="small">
          Program
        </Button>
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

      <Stack spacing={3}>
        {/**
         * If the user has an active program, show a button to dropdown to
         * create training from any day of the program.
         */}
        <DataStateView data={activeProgram}>
          {activeProgram => {
            return (
              <Box width="100%">
                <Button
                  size="large"
                  startIcon={<AddCircleOutlineRounded />}
                  onClick={programTrainingMenu.onOpen}
                  variant="contained"
                  fullWidth
                >
                  Train {activeProgram.name}
                </Button>
                <SwipeableDrawer {...programTrainingMenu} anchor="top">
                  <Typography variant="h6" sx={{ p: 1 }} textAlign="center">
                    {activeProgram.name}
                  </Typography>
                  <Stack spacing={3}>
                    {SORTED_WEEKDAYS.map(day => day.toLowerCase())
                      .flatMap(day => activeProgram.daysOfWeek[day] ?? []) // filter non-training days
                      .map((templateId, index) => (
                        <Button
                          key={templateId}
                          size="large"
                          variant="outlined"
                          onClick={() => createTrainingLog({ fromTemplateId: templateId })}
                          startIcon={<AddCircleOutlineRounded />}
                          endIcon={<NavigateNextRounded />}
                          sx={{
                            alignItems: 'center',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          Start Day {index + 1}
                        </Button>
                      ))}
                  </Stack>
                </SwipeableDrawer>
              </Box>
            );
          }}
        </DataStateView>

        <Button
          size="small"
          variant="outlined"
          onClick={() => createTrainingLog({ fromTemplateId: null })}
          sx={{ width: '100%' }}
          color="primary"
          startIcon={<AddRounded />}
        >
          Train From Scratch
        </Button>
      </Stack>

      <DataStateView data={logs}>
        {logs =>
          logs.length === 0 ? (
            <Typography sx={{ textAlign: 'center' }} color="textSecondary">
              No training data.
            </Typography>
          ) : (
            <Stack spacing={2} sx={{ padding: theme => theme.spacing(1) }}>
              {logs.map(log => {
                const date = new Date(log.timestamp);
                return (
                  <Paper
                    key={log.id}
                    elevation={3}
                    sx={{
                      padding: theme => theme.spacing(2),
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => navigate(Paths.editor(log.id))}
                  >
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        spacing={3}
                        alignItems="baseline"
                        sx={{
                          borderBottom: theme => `1px solid ${theme.palette.divider}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Typography variant="body1">{SORTED_WEEKDAYS[date.getDay()]}</Typography>
                        <Typography variant="overline" color="textSecondary">
                          {Months[date.getMonth()].slice(0, 3) + ' ' + date.getDate()}
                        </Typography>
                        <Typography variant="caption">
                          {formatDistanceToNowStrict(new Date(log.timestamp), { addSuffix: true })}
                        </Typography>
                      </Stack>
                      <DataStateView data={DataState.map(movementsByLogId, _ => _.get(log.id))}>
                        {movements => {
                          if (!movements) return null;
                          if (movements.length === 0) {
                            return (
                              <Typography sx={{ color: 'text.secondary' }} variant="overline">
                                Empty
                              </Typography>
                            );
                          }
                          if (movements.length < 6) {
                            return (
                              <Stack>
                                {movements.map(movement => (
                                  <Typography key={movement.id}>{movement.name}</Typography>
                                ))}
                              </Stack>
                            );
                          }
                          return (
                            <Stack>
                              {movements.slice(0, 4).map(movement => (
                                <Typography key={movement.id}>{movement.name}</Typography>
                              ))}
                              {movements.length > 4 && (
                                <Typography>+{movements.length - 4} more</Typography>
                              )}
                            </Stack>
                          );
                        }}
                      </DataStateView>
                    </Stack>
                    <NavigateNextRounded sx={{ color: theme => theme.palette.primary.main }} />
                  </Paper>
                );
              })}
            </Stack>
          )
        }
      </DataStateView>

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

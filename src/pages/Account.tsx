import { uuidv4 } from '@firebase/util';
import { AddRounded, Google, Launch, Logout, NavigateNextRounded } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  FormHelperText,
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
import { WithVariable } from '../components';
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
import { Movement, Program } from '../types';

export const Account: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const reauthDrawer = useMaterialMenu();

  // Get active program (if it exists for auth'd user) to display upcoming
  // training AND power the create training log from active program button.
  const [activeProgram] = useActiveProgram();

  // A subset of the users logs to display in detail
  const [logs] = useDataState(
    () => API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(8)),
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
          id: '',
          note: '',
          programId: programId || null,
          programLogTemplateId: fromTemplateId || null,
        });
        // Copy over movements from the program log template to the log
        if (!!fromTemplateId) {
          const programMovements = await API.ProgramMovements.getAll(
            where('logId', '==', fromTemplateId)
          );
          const logMovements = programMovements.map(movement => ({
            ...movement,
            logId: newTrainingLog.id,
            sets: movement.sets.map(s => ({ ...s, uuid: uuidv4() })),
            timestamp: Date.now(),
          }));
          await API.Movements.createMany(logMovements);
        }
        navigate(Paths.editor(newTrainingLog.id));
        const extra =
          !!fromTemplateId && DataState.isReady(activeProgram) && ` for ${activeProgram.name}`;
        toast.success(`Created new training page${extra}.`);
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

      <Stack spacing={2}>
        {/** If the user has training remaining in this week from their Program, show a button to hit it. */}
        <WithVariable value={Program.getNextTraining(activeProgram)}>
          {result => {
            if (!result) return null;
            const { templateId, text } = result;
            return (
              <Stack>
                <FormHelperText>Up Next:</FormHelperText>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={() => createTrainingLog({ fromTemplateId: templateId })}
                  sx={{ width: '100%' }}
                  color="primary"
                  startIcon={<AddRounded />}
                  endIcon={<NavigateNextRounded />}
                >
                  {text}
                </Button>
              </Stack>
            );
          }}
        </WithVariable>
        <Button
          size="small"
          variant="text"
          onClick={() => createTrainingLog({ fromTemplateId: null })}
          sx={{ width: '100%' }}
          color="primary"
          startIcon={<AddRounded />}
          endIcon={<NavigateNextRounded />}
        >
          New Training
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
                  <Box
                    key={log.id}
                    sx={{
                      border: theme => `2px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      padding: theme => theme.spacing(2, 3),
                    }}
                    onClick={() => navigate(Paths.editor(log.id))}
                    display="flex"
                    justifyContent="space-between"
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
                        <Typography variant="body2">{SORTED_WEEKDAYS[date.getDay()]}</Typography>
                        <Typography variant="overline" color="textSecondary">
                          {Months[date.getMonth()].slice(0, 3) + ' ' + date.getDate()}
                        </Typography>
                        <Typography variant="caption">
                          {formatDistanceToNowStrict(new Date(log.timestamp), { addSuffix: true })}
                        </Typography>
                      </Stack>
                      <DataStateView data={DataState.map(movementsByLogId, _ => _.get(log.id))}>
                        {movements =>
                          !movements?.length ? (
                            <Typography sx={{ color: 'text.secondary' }} variant="overline">
                              Empty
                            </Typography>
                          ) : (
                            <Stack>
                              {movements.slice(0, 3).map(movement => (
                                <Typography variant="body2" key={movement.id} color="textSecondary">
                                  {movement.name}
                                </Typography>
                              ))}
                              {movements.length > 3 && (
                                <Typography variant="body2" color="textSecondary">
                                  {movements[3].name} ...and {movements.length - 3} more
                                </Typography>
                              )}
                            </Stack>
                          )
                        }
                      </DataStateView>
                    </Stack>
                    <NavigateNextRounded sx={{ color: 'text.secondary' }} />
                  </Box>
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

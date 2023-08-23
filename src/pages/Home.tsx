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
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { signOut } from 'firebase/auth';
import { limit, orderBy, where } from 'firebase/firestore';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { API, auth, Authenticate, DbPath } from '../api';
import { useUser } from '../context';
import { Movement, ProgramLogTemplate } from '../types';
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

export const Home: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const reauthDrawer = useMaterialMenu();
  const programTrainingMenu = useMaterialMenu();

  // Get active program if it exists for auth'd user
  const [activeProgram] = useActiveProgram();

  const templates = DataState.from<ProgramLogTemplate[]>(
    useQuery({
      enabled: DataState.isReady(activeProgram),
      queryKey: [DbPath.ProgramLogTemplates, user.uid, activeProgram],
      queryFn: () => {
        if (!DataState.isReady(activeProgram)) return Promise.reject('activeProgram not ready.');
        return API.ProgramLogTemplates.getAll(
          user.uid,
          where('id', 'in', activeProgram.templateIds)
        );
      },
    })
  );

  // A subset of the users logs to display in detail
  const [logs] = useDataState(
    () => API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(100)),
    [user.uid]
  );

  const [movementsByLogId] = useDataState<Map<string, Movement[]>>(async () => {
    if (!DataState.isReady(logs)) return logs;
    const movementLists = await Promise.all(
      logs.map(_ => API.Movements.getAll(where('logId', '==', _.id), orderBy('position', 'asc')))
    );
    // Construct empty map to hold sorted movements
    const movementsByLogId = new Map<string, Movement[]>(logs.map(_ => [_.id, []]));
    // Populate
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
        maxWidth: theme => theme.breakpoints.values.sm,
        margin: '0 auto',
        padding: theme => theme.spacing(2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between" alignItems="baseline">
        <Button onClick={() => navigate(Paths.program)} variant="text">
          Program
        </Button>
        <Typography variant="caption">
          Welcome,{' '}
          {user.isAnonymous ? 'Anonymous' : user.displayName || user.providerData[0]?.displayName}
        </Typography>
        <IconButton size="small" onClick={deauthenticate}>
          <Logout fontSize="small" />
        </IconButton>
      </Box>

      <Stack spacing={2} sx={{ padding: theme => theme.spacing(1) }}>
        <DataStateView data={DataState.all(activeProgram, templates)}>
          {([activeProgram, templates]) => {
            return (
              <>
                <Typography variant="overline">{activeProgram.name}</Typography>
                {templates.map(template => (
                  <Button
                    key={template.id}
                    size="large"
                    variant="outlined"
                    onClick={() => createTrainingLog({ fromTemplateId: template.id })}
                    startIcon={<AddCircleOutlineRounded />}
                    endIcon={<NavigateNextRounded />}
                    sx={{
                      alignItems: 'center',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    Train {template.name}
                  </Button>
                ))}
              </>
            );
          }}
        </DataStateView>

        <Button
          startIcon={<AddRounded />}
          onClick={() => createTrainingLog({ fromTemplateId: null })}
          endIcon={<NavigateNextRounded />}
        >
          From Scratch
        </Button>
      </Stack>

      <DataStateView data={logs}>
        {logs =>
          logs.length === 0 ? (
            <Typography sx={{ textAlign: 'center' }} color="textSecondary">
              No training data.
            </Typography>
          ) : (
            <Stack spacing={5} sx={{ padding: theme => theme.spacing(0) }}>
              {logs.map((log, logIndex, { length }) => {
                const date = new Date(log.timestamp);
                return (
                  <Paper
                    key={log.id}
                    elevation={0}
                    sx={{
                      borderTop: theme => `2px solid ${theme.palette.divider}`,
                      padding: theme => theme.spacing(3),
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => navigate(Paths.editor(log.id))}
                  >
                    <Stack spacing={1}>
                      <Typography
                        variant="h6"
                        fontStyle="italic"
                        sx={{ color: 'divider', fontWeight: 'bold' }}
                      >
                        Training Log #{length - logIndex}
                      </Typography>
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
                      {/** "In the morning", "At night" display */}
                      <Typography variant="overline" color="textSecondary">
                        {format(new Date(log.timestamp), 'BBBB')}
                      </Typography>
                      {/** Assumes the the log index is less than the limit for logs fetched. */}
                      {log?.note && (
                        <Typography variant="caption" color="textSecondary">
                          {log.note.slice(0, 75) + (log.note.length > 75 ? '...' : '')}
                        </Typography>
                      )}
                    </Stack>
                    <Stack spacing={2}>
                      <Box
                        display="flex"
                        justifyContent="flex-end"
                        whiteSpace="nowrap"
                        alignItems="center"
                      >
                        <Typography variant="body1" color="textSecondary" mr={1}>
                          {Months[date.getMonth()] + ' ' + date.getDate()}
                        </Typography>
                        <NavigateNextRounded fontSize="large" sx={{ color: 'text.secondary' }} />
                      </Box>
                      <Stack>
                        <Typography variant="caption" fontStyle="italic">
                          {SORTED_WEEKDAYS[date.getDay()]}
                        </Typography>
                        <Typography variant="body1" color="textSecondary" whiteSpace="nowrap">
                          {formatDistanceToNowStrict(new Date(log.timestamp), { addSuffix: true })}
                        </Typography>
                      </Stack>
                    </Stack>
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

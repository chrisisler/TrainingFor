import { uuidv4 } from '@firebase/util';
import {
  AddRounded,
  Google,
  Launch,
  LightModeTwoTone,
  Logout,
  NavigateNextRounded,
  NightsStayTwoTone,
} from '@mui/icons-material';
import {
  alpha,
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
import { where } from 'firebase/firestore';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { API, auth, Authenticate, useStore } from '../api';
import { useUser } from '../context';
import { Movement } from '../types';
import {
  DataState,
  DataStateView,
  Months,
  Paths,
  SORTED_WEEKDAYS,
  useMaterialMenu,
  useToast,
} from '../util';

export const Home: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const reauthDrawer = useMaterialMenu();

  const activeProgram = useStore(store => store.activeProgram);
  const logs = useStore(store => store.logs);
  const movementsByLogId = useStore(store => store.movementsByLogId);
  const templates = useStore(store => store.templates);
  const TrainingLogsAPI = useStore(store => store.TrainingLogsAPI);

  const createTrainingLog = useCallback(
    async ({ fromTemplateId }: { fromTemplateId: string | null }) => {
      try {
        const programId = !!fromTemplateId && DataState.isReady(activeProgram) && activeProgram.id;
        const newTrainingLog = await TrainingLogsAPI.create({
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
    [activeProgram, user.uid, navigate, toast, TrainingLogsAPI]
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
      spacing={1}
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

      <Stack spacing={2} sx={{ padding: theme => theme.spacing(0, 1, 1) }}>
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
                    startIcon={<AddRounded />}
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
            <Stack spacing={4} sx={{ padding: theme => theme.spacing(0) }}>
              {logs.map(log => {
                const date = new Date(log.timestamp);
                const programName = DataState.isReady(activeProgram) ? activeProgram.name : '';
                const templateName =
                  (DataState.isReady(templates) &&
                    templates.find(t => t.id === log.programLogTemplateId)?.name) ||
                  '';
                return (
                  <Paper
                    key={log.id}
                    elevation={0}
                    sx={theme => {
                      const gradientBg = theme.make.background(
                        alpha(theme.palette.primary.main, 0.05),
                        theme.palette.background.default
                      );
                      return {
                        // border: `1px solid ${theme.palette.divider}`,
                        padding: theme.spacing(3),
                        display: 'flex',
                        justifyContent: 'space-between',
                        background: gradientBg,
                      };
                    }}
                    onClick={() => navigate(Paths.editor(log.id))}
                  >
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {/** Large icon for day/night (evening situation) */}
                        {date.getHours() > 18 ? (
                          <NightsStayTwoTone sx={{ fontSize: '3rem' }} />
                        ) : (
                          <LightModeTwoTone sx={{ fontSize: '3rem' }} />
                        )}
                        {/** Bold program name + template name if Log is from template */}
                        {templateName && programName && (
                          <Stack>
                            <Typography variant="overline" lineHeight={1.5}>
                              <b>{programName}</b>
                            </Typography>
                            <Typography variant="overline" lineHeight={1.5}>
                              <em>{templateName}</em>
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" whiteSpace="nowrap">
                        {/** Bold + large + all caps name of day */}
                        <Typography fontWeight={600}>{SORTED_WEEKDAYS[date.getDay()]}</Typography>
                        <Typography variant="body2" fontStyle="italic" color="text.secondary">
                          {formatDistanceToNowStrict(new Date(log.timestamp), {
                            addSuffix: true,
                          })
                            .replace(/ (\w)\w+ /i, '$1 ')
                            .replace('m ', 'mo ')}
                        </Typography>
                      </Stack>
                      {/** regular list of movements */}
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
                      {/** Assumes the the log index is less than the limit for logs fetched. */}
                      {log?.note && (
                        <Typography variant="caption" color="textSecondary">
                          {log.note.slice(0, 75) + (log.note.length > 75 ? '...' : '')}
                        </Typography>
                      )}
                    </Stack>
                    <Box
                      display="flex"
                      justifyContent="flex-end"
                      whiteSpace="nowrap"
                      alignItems="start"
                    >
                      <Stack direction="row" alignItems="center">
                        <Typography variant="body2" textTransform="uppercase">
                          {Months[date.getMonth()].slice(0, 3) + ' ' + date.getDate()}
                        </Typography>
                        <NavigateNextRounded sx={{ color: 'text.primary' }} fontSize="large" />
                      </Stack>
                    </Box>
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

import { uuidv4 } from '@firebase/util';
import {
  AddRounded,
  ArrowForwardIos,
  CloseRounded,
  Google,
  InfoOutlined,
  Launch,
  Logout,
  SettingsOutlined,
} from '@mui/icons-material';
import {
  alpha,
  Box,
  Button,
  Collapse,
  IconButton,
  Skeleton,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { signOut } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { FC, useCallback, useState } from 'react';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate } from 'react-router-dom';

import { API, auth, Authenticate, useStore } from '../api';
import { Movement, Program } from '../types';
import {
  DataState,
  DataStateView,
  dateDisplay,
  Paths,
  SORTED_WEEKDAYS,
  useMaterialMenu,
  useToast,
  useUser,
} from '../util';

export const Home: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const reauthDrawer = useMaterialMenu();
  const addProgramDrawer = useMaterialMenu();
  const theme = useTheme();
  const gradientBg = theme.make.background(
    alpha(theme.palette.primary.main, 0.03),
    theme.palette.background.default
  );

  const [newProgramName, setNewProgramName] = useState('');

  const activeProgram = useStore(store => store.activeProgram);
  const logs = useStore(store => store.logs);
  const movementsByLogId = useStore(store => store.movementsByLogId);
  const templates = useStore(store => store.templates);

  const trainingLogsCount = useStore(store => store.useTrainingLogsCount(user.uid));
  const TrainingLogsAPI = useStore(store => store.TrainingLogsAPI);
  const ProgramsAPI = useStore(store => store.ProgramsAPI);
  const MovementsAPI = useStore(store => store.MovementsAPI);
  const SavedMovementsAPI = useStore(store => store.SavedMovementsAPI);
  const programs = useStore(store =>
    // List of programs with active program first
    DataState.map(store.programs, _programs => {
      const active = store.activeProgram;
      if (DataState.isReady(active)) {
        const first = _programs.find(p => p.id === active.id);
        if (first) return [first, ..._programs.filter(_ => _.id !== active.id)];
      }
      return _programs;
    })
  );

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
            MovementsAPI.createMany(logMovements),
            // Update lastSeen property for each movement's savedMovement parent
            logMovements.map(_ =>
              SavedMovementsAPI.update({ id: _.savedMovementId, lastSeen: _.timestamp })
            ),
          ]);
        }
        navigate(Paths.editor(newTrainingLog.id));
      } catch (err) {
        toast.error(err.message);
      }
    },
    [activeProgram, user.uid, navigate, toast, TrainingLogsAPI, MovementsAPI, SavedMovementsAPI]
  );

  const deauthenticate = useCallback(async () => {
    if (!window.confirm('Sign out?')) return;
    try {
      await signOut(auth);
      toast.info('Signed out');
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
        overflowY: 'scroll',
        maxWidth: theme => theme.breakpoints.values.md,
        margin: '0 auto',
        padding: theme => theme.spacing(4),
        backgroundColor: theme =>
          theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : theme.palette.action.hover,
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between" alignItems="baseline">
        <Stack>
          <Typography
            variant="h6"
            fontWeight={600}
            onClick={user.isAnonymous ? reauthDrawer.onOpen : void 0}
          >
            {user.isAnonymous ? 'Anonymous' : user.displayName || user.providerData[0]?.displayName}
          </Typography>
          {DataState.isReady(trainingLogsCount) && (
            <Typography color="textSecondary" variant="caption">
              Trained {trainingLogsCount} {trainingLogsCount === 1 ? 'time' : 'times'}
            </Typography>
          )}
        </Stack>
        <IconButton size="small" onClick={deauthenticate}>
          <Logout fontSize="small" sx={{ color: theme => theme.palette.text.secondary }} />
        </IconButton>
      </Box>

      <Stack spacing={1}>
        <DataStateView
          data={DataState.all(activeProgram, templates)}
          loading={() => <Skeleton height={40} />}
        >
          {([activeProgram, templates]) => {
            return (
              <Stack spacing={1}>
                <Typography
                  fontWeight={600}
                  color="textSecondary"
                  onClick={() => navigate(Paths.program(activeProgram.id))}
                >
                  {activeProgram.name}
                </Typography>
                {templates
                  .filter(_ => activeProgram.templateIds.includes(_.id)) // TODO store.useTemplates(...)
                  .map(template => (
                    <Box
                      key={template.id}
                      onClick={() => createTrainingLog({ fromTemplateId: template.id })}
                      sx={{
                        width: '100%',
                        padding: theme => theme.spacing(1.5),
                        borderRadius: 2,
                        background: gradientBg,
                        alignItems: 'center',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography>{template.name || 'Program'}</Typography>
                      <Button
                        endIcon={<ArrowForwardIos />}
                        sx={{ textTransform: 'none' }}
                        variant="outlined"
                      >
                        Train
                      </Button>
                    </Box>
                  ))}
              </Stack>
            );
          }}
        </DataStateView>
        <Button
          endIcon={<ArrowForwardIos />}
          onClick={() => createTrainingLog({ fromTemplateId: null })}
        >
          New Session
        </Button>
      </Stack>

      <Box>
        <Typography fontWeight={600} color="textSecondary" gutterBottom>
          Training Programs
        </Typography>
        <Stack direction="row" spacing={2} sx={{ width: '100%', overflowX: 'scroll' }}>
          <DataStateView
            data={programs}
            loading={() => (
              <>
                <Skeleton variant="text" width={80} />
                <Skeleton variant="rounded" />
                <Skeleton variant="text" width={80} />
                <Skeleton variant="rounded" />
              </>
            )}
          >
            {programs => (
              <>
                {programs.map(program => (
                  <ProgramPreview
                    key={program.id}
                    program={program}
                    isActive={DataState.isReady(activeProgram) && activeProgram.id === program.id}
                    onClick={() => navigate(Paths.program(program.id))}
                  />
                ))}
              </>
            )}
          </DataStateView>
          <ProgramPreview onClick={event => addProgramDrawer.onOpen(event)} />
        </Stack>
      </Box>

      <Stack>
        <Typography fontWeight={600} color="textSecondary" gutterBottom>
          Training Sessions
        </Typography>

        <DataStateView
          data={logs}
          loading={() => (
            <Stack>
              <Stack direction="row">
                <Skeleton variant="rounded" />
                <Skeleton variant="text" />
              </Stack>
              <Skeleton width="100%" variant="rectangular" />
              <Skeleton width="100%" variant="rectangular" />
            </Stack>
          )}
        >
          {logs =>
            logs.length === 0 ? null : (
              <Stack spacing={4} sx={{ padding: theme => theme.spacing(0) }}>
                {logs.map(log => {
                  const date = new Date(log.timestamp);
                  const programName = DataState.isReady(activeProgram) ? activeProgram.name : '';
                  const templateName =
                    (DataState.isReady(templates) &&
                      templates.find(t => t.id === log.programLogTemplateId)?.name) ||
                    '';
                  return (
                    <Box
                      key={log.id}
                      sx={theme => ({
                        border: `2px solid ${theme.palette.divider}`,
                        padding: theme.spacing(3),
                        display: 'flex',
                        justifyContent: 'space-between',
                      })}
                      onClick={() => navigate(Paths.editor(log.id))}
                    >
                      <Stack spacing={1} width="100%">
                        <Stack
                          width="100%"
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Stack
                            direction="row"
                            spacing={1.5}
                            display="flex"
                            whiteSpace="nowrap"
                            alignItems="baseline"
                          >
                            <Typography variant="h6">{SORTED_WEEKDAYS[date.getDay()]}</Typography>
                            <Typography color="text.secondary">{dateDisplay(date)}</Typography>
                            <Typography
                              color="text.secondary"
                              variant="overline"
                              sx={{ textTransform: 'lowercase' }}
                            >
                              <em>
                                {formatDistanceToNowStrict(new Date(log.timestamp), {
                                  addSuffix: true,
                                })
                                  .replace(/ (\w)\w+ /i, '$1 ')
                                  .replace('m ', 'mo ')
                                  .replace(' ago', '')}
                              </em>
                            </Typography>
                          </Stack>

                          <IconButton>
                            <ArrowForwardIos
                              sx={{ color: theme => theme.palette.text.secondary }}
                            />
                          </IconButton>
                        </Stack>
                        {/** List of movement names for each recent log from the user. */}
                        {/** TODO component-ize and put movementsByLogId inside component. */}
                        <DataStateView
                          data={movementsByLogId}
                          loading={() => (
                            <>
                              <Skeleton variant="text" />
                              <Skeleton variant="text" />
                              <Skeleton variant="text" />
                            </>
                          )}
                        >
                          {map => {
                            const movements = !!map && map.get(log.id);
                            if (!movements) return null;
                            if (movements.length === 0) {
                              return (
                                <Typography variant="caption" fontStyle="italic">
                                  No movements in this training
                                </Typography>
                              );
                            }
                            if (movements.length < 6) {
                              return (
                                <>
                                  {movements.map(movement => (
                                    <Typography key={movement.id}>{movement.name}</Typography>
                                  ))}
                                </>
                              );
                            }
                            return (
                              <>
                                {movements.slice(0, 4).map(movement => (
                                  <Typography key={movement.id}>{movement.name}</Typography>
                                ))}
                                {movements.length > 4 && (
                                  <Typography>+{movements.length - 4} more</Typography>
                                )}
                              </>
                            );
                          }}
                        </DataStateView>
                        {/** Assumes the the log index is less than the limit for logs fetched. */}
                        {log?.note && (
                          <Typography variant="caption" color="textSecondary">
                            {log.note.slice(0, 75) + (log.note.length > 75 ? '...' : '')}
                          </Typography>
                        )}
                        {/** Bold program name + template name if Log is from template */}
                        {templateName && programName && (
                          <Stack
                            sx={{ borderTop: theme => `1px solid ${theme.palette.divider}`, pt: 2 }}
                          >
                            <Typography variant="overline" lineHeight={1.5} color="text.secondary">
                              {programName}
                            </Typography>
                            <Typography variant="overline" lineHeight={1.5} fontWeight={600}>
                              {templateName}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                      <Box
                        display="flex"
                        justifyContent="flex-end"
                        whiteSpace="nowrap"
                        alignItems="start"
                      ></Box>
                    </Box>
                  );
                })}
              </Stack>
            )
          }
        </DataStateView>
      </Stack>

      {/** Drawer to reassign data from current anon user to google auth'd account */}
      {user.isAnonymous && DataState.isReady(logs) && logs.length > 0 && (
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
                    toast.info('Assigned data to new persistent account');
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
      )}

      <SwipeableDrawer {...addProgramDrawer} anchor="top">
        <Stack spacing={2}>
          <ReactFocusLock disabled={!addProgramDrawer.open} returnFocus>
            <TextField
              fullWidth
              variant="standard"
              label="Program Name"
              value={newProgramName}
              onChange={event => setNewProgramName(event.target.value)}
              InputProps={{
                endAdornment: !!newProgramName && (
                  <IconButton size="small" onClick={() => setNewProgramName('')}>
                    <CloseRounded />
                  </IconButton>
                ),
              }}
            />
          </ReactFocusLock>
          <Button
            variant="text"
            disabled={newProgramName.trim().length === 0}
            startIcon={<AddRounded />}
            size="large"
            onClick={async function createProgram() {
              try {
                const created = await ProgramsAPI.create({
                  name: newProgramName,
                  authorUserId: user.uid,
                  timestamp: Date.now(),
                  note: '',
                  templateIds: [],
                });
                setNewProgramName('');
                navigate(Paths.program(created.id));
                addProgramDrawer.onClose();
              } catch (error) {
                toast.error(error.message);
              }
            }}
          >
            Add Program
          </Button>
        </Stack>
      </SwipeableDrawer>
    </Stack>
  );
};

const ProgramPreview: FC<{
  /** Renders "add button" when not provided. */
  program?: Program;
  isActive?: boolean;
  onClick: React.MouseEventHandler<HTMLDivElement>;
}> = ({ program, isActive = false, onClick }) => {
  return (
    <Box
      sx={{
        backgroundColor: theme =>
          theme.palette.mode === 'dark'
            ? theme.palette.action.hover
            : theme.palette.background.default,
        padding: theme => theme.spacing(5, 2),
        border: theme => `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        minWidth: '250px',
      }}
      onClick={onClick}
    >
      <Stack direction="row" display="flex" width="100%" justifyContent="space-between">
        {program ? (
          <Stack spacing={1}>
            <Typography>{program.name}</Typography>
            <Typography color="textSecondary" variant="body2">
              {program.templateIds.length} Template{program.templateIds.length > 1 ? 's' : ''}
            </Typography>

            {isActive && (
              <Stack direction="row" spacing={1} pt={1} alignItems="center">
                <InfoOutlined
                  sx={{ color: theme => theme.palette.text.secondary }}
                  fontSize="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Program is active
                </Typography>
              </Stack>
            )}
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Button variant="outlined" startIcon={<AddRounded />} sx={{ textTransform: 'none' }}>
              New Program
            </Button>
            <Typography color="textSecondary" variant="body2">
              Make your own templates
            </Typography>
          </Stack>
        )}
        <SettingsOutlined fontSize="large" sx={{ color: theme => theme.palette.text.secondary }} />
      </Stack>
    </Box>
  );
};

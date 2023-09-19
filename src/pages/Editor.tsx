import { uuidv4 } from '@firebase/util';
import {
  Add,
  AddRounded,
  CheckRounded,
  Close,
  CloseRounded,
  DeleteForeverRounded,
  DeleteOutline,
  DeleteRounded,
  EditOutlined,
  FindReplaceRounded,
  MoreHoriz,
  NavigateNextRounded,
  PersonOutline,
  RefreshRounded,
  ShortTextRounded,
} from '@mui/icons-material';
import {
  alpha,
  Backdrop,
  Box,
  Button,
  Collapse,
  colors,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  SelectProps,
  Stack,
  SwipeableDrawer,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { limit, orderBy, where } from 'firebase/firestore';
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate, useParams } from 'react-router-dom';

import { API, useStore } from '../api';
import { NotesDrawer, tabA11yProps, TabPanel, WithVariable } from '../components';
import { useUser } from '../context';
import {
  Movement,
  MovementWeightUnit,
  MovementRepCountUnit,
  SavedMovement,
  MovementSetStatus,
  MovementSet,
  TrainingLog,
} from '../types';
import {
  DataState,
  DataStateView,
  dateDisplay,
  ordinalSuffix,
  Paths,
  useDrawer,
  useResizableInputRef,
  useToast,
} from '../util';

const DIFF_CHAR = 'to';

const DEFAULT_MIN_REPS = 5;
const DEFAULT_MAX_REPS = 30;

/**
 * Wrapper page for editing training entries.
 */
export const Editor: FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { logId } = useParams<{ logId: string }>();
  const { anchorEl: _0, ...logDrawer } = useDrawer<undefined>();
  const notesDrawer = useDrawer<TrainingLog>();
  const programDrawer = useDrawer<string>();

  const [confetti, setConfetti] = useState(false);

  const log = useStore(store => {
    if (!logId) return DataState.Empty;
    return DataState.map(
      store.logs,
      logs => logs.find(_ => _.id === logId) ?? DataState.error('Log not found.')
    );
  });
  const TrainingLogsAPI = useStore(store => store.TrainingLogsAPI);
  const programUser = useStore(store => store.programUser);
  const movements = useStore(store => (logId ? store.useMovements(logId) : DataState.Empty));

  const finishTrainingLog = useCallback(async () => {
    if (!logId) return;
    try {
      await TrainingLogsAPI.update({ id: logId, isFinished: true });
    } catch (err) {
      toast.error(err.message);
    }
  }, [logId, toast, TrainingLogsAPI]);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100vw',
        maxWidth: theme => theme.breakpoints.values.sm,
        margin: '0 auto',
        overflowY: 'scroll',
        padding: theme => theme.spacing(0.5, 2, 3, 2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between" alignItems="center">
        <DataStateView
          data={DataState.all(log, programUser)}
          error={() => (
            <Button variant="contained" onClick={() => navigate(Paths.home)}>
              Go back
            </Button>
          )}
        >
          {([log, programUser]) => (
            <Stack direction="row" spacing={1.5} alignItems="baseline">
              <Typography variant="caption" color="textSecondary">
                {dateDisplay(new Date(log.timestamp))}
              </Typography>
              {log.programId === programUser.activeProgramId && (
                <Typography
                  variant="overline"
                  sx={{ color: theme => alpha(theme.palette.text.secondary, 0.4) }}
                  onClick={event => {
                    if (!log.programLogTemplateId) throw Error('Unreachable: Empty template ID.');
                    programDrawer.onOpen(event, log.programLogTemplateId);
                  }}
                >
                  <b>{programUser.activeProgramName}</b>
                </Typography>
              )}
            </Stack>
          )}
        </DataStateView>
        <IconButton onClick={event => logDrawer.onOpen(event, void 0)}>
          <ShortTextRounded sx={{ color: 'text.primary' }} />
        </IconButton>
      </Box>

      <SwipeableDrawer {...programDrawer.props()} anchor="bottom">
        <WithVariable value={programDrawer.getData()}>
          {programLogTemplateId => {
            if (!programLogTemplateId) return null;
            return (
              <Box
                sx={{
                  height: '80vh',
                  width: '100%',
                  overflowY: 'scroll',
                }}
              >
                <Typography variant="overline" fontWeight={600}>
                  Editing Program Template...
                </Typography>
                <EditorInternals isProgramView logId={programLogTemplateId} />
              </Box>
            );
          }}
        </WithVariable>
      </SwipeableDrawer>

      <DataStateView data={logId || DataState.Empty}>
        {logId => <EditorInternals logId={logId} />}
      </DataStateView>

      <SwipeableDrawer {...logDrawer.props()} anchor="top">
        <Collapse in={logDrawer.open}>
          <Grid
            container
            rowSpacing={2}
            columnSpacing={1}
            direction="row-reverse"
            justifyContent="space-evenly"
          >
            <Grid item xs={4}>
              <Button variant="outlined" onClick={() => navigate(Paths.home)}>
                <PersonOutline />
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                variant="outlined"
                disabled={!DataState.isReady(log)}
                onClick={event => {
                  if (!DataState.isReady(log)) return;
                  notesDrawer.onOpen(event, log);
                }}
              >
                Note
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                variant="outlined"
                onClick={() => {
                  toast.info('Unimplemented: Update log timestamp.');
                }}
              >
                {DataState.isReady(log) && (
                  <WithVariable value={new Date(log.timestamp)}>
                    {date => <>{dateDisplay(date)}</>}
                  </WithVariable>
                )}
              </Button>
            </Grid>
            <Grid item xs={4}>
              <TextField
                size="small"
                variant="standard"
                label="Bodyweight"
                key={DataState.isReady(log) ? log.bodyweight : undefined}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                onFocus={event => event.currentTarget.select()}
                defaultValue={(DataState.isReady(log) && log.bodyweight) || void 0}
                onBlur={async function updateTrainingLogBodyweight(event) {
                  if (Number.isNaN(event.target.value)) return;
                  if (!DataState.isReady(log)) return;
                  const newBodyweight = +event.target.value;
                  if (newBodyweight === log.bodyweight) return;
                  try {
                    await TrainingLogsAPI.update({
                      id: log.id,
                      bodyweight: newBodyweight,
                    });
                    toast.info('Updated bodyweight.');
                  } catch (error) {
                    toast.error(error.message);
                  }
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <Button
                variant="outlined"
                disabled={!DataState.isReady(movements)}
                onClick={async () => {
                  if (!DataState.isReady(movements)) return;
                  const allSetsDone = movements.every(m =>
                    m.sets.every(s => s.status === MovementSetStatus.Completed)
                  );
                  if (allSetsDone) {
                    await finishTrainingLog();
                    setConfetti(true);
                    const word = Math.random() > 0.5 ? 'effort' : 's**t';
                    toast.info(`Good ${word}! I mean, congrations!!`);
                    return;
                  }
                  toast.info('Must complete all grey sets to finish.');
                }}
              >
                Finish
              </Button>
              {confetti && <ConfettiExplosion particleCount={150} width={500} force={1} />}
            </Grid>
            <Grid item xs={4}>
              <Button
                color="error"
                variant="outlined"
                onClick={async () => {
                  if (!logId) throw Error('Unreachable');
                  if (!window.confirm('Delete Training?')) return;
                  try {
                    await TrainingLogsAPI.delete(logId);
                    logDrawer.onClose();
                    navigate(Paths.home);
                    toast.info('Deleted training.');
                  } catch (error) {
                    toast.error(error.message);
                  }
                }}
              >
                <DeleteForeverRounded />
              </Button>
            </Grid>
          </Grid>
        </Collapse>
      </SwipeableDrawer>

      <SwipeableDrawer {...notesDrawer.props()} anchor="bottom">
        <Collapse in={notesDrawer.open}>
          {DataState.isReady(log) && (
            <NotesDrawer
              note={log?.note || ''}
              onBlur={async (next: string) => {
                try {
                  await TrainingLogsAPI.update({
                    id: log.id,
                    note: next,
                  });
                } catch (error) {
                  toast.error(error.message);
                }
              }}
            />
          )}
        </Collapse>
      </SwipeableDrawer>
    </Box>
  );
};

/** Built for the SavedMovement edit/update menu with history tab. */
enum TabIndex {
  Edit = 0,
  History = 1,
}

export const EditorInternals: FC<{
  logId: string;
  isProgramView?: boolean;
  readOnly?: boolean;
}> = ({ logId, isProgramView = false, readOnly = false }) => {
  const toast = useToast();
  const user = useUser();
  // Data is null when *adding*; when *replacing*, it's the replacing Movement.
  const { anchorEl: _3, ...addMovementDrawer } = useDrawer<null | Movement>();
  const addSetMenu = useDrawer<Movement>();
  const { anchorEl: _0, ...savedMovementDrawer } = useDrawer<SavedMovement>();
  const { anchorEl: _1, ...movementMenuDrawer } = useDrawer<Movement>();
  const { anchorEl: _2, ...historyLogDrawer } = useDrawer<Movement>();

  /** Controlled state of the Add Movement input. */
  const [movementNameQuery, setMovementNameQuery] = useState('');
  /** Controlled state of the Add Set inputs. */
  const [newSetWeight, setNewSetWeight] = useState(0);
  const [newSetRepCountMin, setNewSetRepCountMin] = useState(DEFAULT_MIN_REPS);
  const [newSetRepCountMax, setNewSetRepCountMax] = useState(DEFAULT_MAX_REPS);
  /** State for re-ordering the list of movements. Holds the Movement to swap places with. */
  const [movementOrderSwap, setMovementOrderSwap] = useState<null | Movement>(null);
  /** For SavedMovement edit/update menu. */
  const [tabValue, setTabValue] = useState(TabIndex.Edit);

  const MovementsMutationAPI = useStore(store =>
    isProgramView ? store.ProgramMovementsAPI : store.MovementsAPI
  );
  const SavedMovementsAPI = useStore(store => store.SavedMovementsAPI);
  const savedMovements = useStore(store => store.savedMovements);
  const movements = useStore(store => store.useMovements(logId, isProgramView));

  /** The active collection, based on the usage of this component. */
  const MovementsQueryAPI = useMemo(
    () => (isProgramView ? API.ProgramMovements : API.Movements),
    [isProgramView]
  );

  // Handle debounced search for SavedMovements
  const [matches, setMatches] = useState<DataState<SavedMovement[]>>(DataState.Empty);
  useEffect(() => {
    if (!DataState.isReady(savedMovements)) return;
    if (movementNameQuery === '') {
      // No search input, so show all SavedMovements
      setMatches(savedMovements);
      return;
    }
    const t = setTimeout(async () => {
      const query = movementNameQuery.toLowerCase();
      setMatches(savedMovements.filter(_ => _.name.toLowerCase().includes(query)));
    }, 400);
    return () => clearTimeout(t);
  }, [movementNameQuery, savedMovements]);

  const addMovementFromNewSavedMovement = useCallback(async () => {
    if (!logId) throw TypeError('Unreachable: logId is required');
    if (!DataState.isReady(movements)) return;
    try {
      const timestamp: number = Date.now();
      const newSavedMovement: SavedMovement = await SavedMovementsAPI.create({
        note: '',
        name: movementNameQuery,
        authorUserId: user.uid,
        lastSeen: timestamp,
      });
      const position = movements.length > 0 ? movements[movements.length - 1].position + 1 : 0;
      await MovementsMutationAPI.create({
        logId,
        name: newSavedMovement.name,
        timestamp,
        sets: [],
        authorUserId: user.uid,
        savedMovementId: newSavedMovement.id,
        savedMovementName: newSavedMovement.name,
        position,
        isFavorited: false,
        weightUnit: MovementWeightUnit.Pounds,
        repCountUnit: MovementRepCountUnit.Reps,
      });
      addMovementDrawer.onClose();
      setMovementNameQuery('');
    } catch (error) {
      toast.error(error.message);
    }
  }, [
    MovementsMutationAPI,
    movements,
    logId,
    movementNameQuery,
    user.uid,
    addMovementDrawer,
    toast,
    SavedMovementsAPI,
  ]);

  const addMovementFromExistingSavedMovement = useCallback(
    async (match: SavedMovement, overrides: Partial<Movement> = {}): Promise<void> => {
      if (!logId) throw Error('Unreachable: logId is required');
      if (!DataState.isReady(movements)) return;
      if (!DataState.isReady(savedMovements)) return;
      try {
        /** The movement data from the last time the user performed this movement. */
        const [previous] = await MovementsQueryAPI.getAll(
          where('savedMovementId', '==', match.id),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const position = movements.length > 0 ? movements[movements.length - 1].position + 1 : 0;
        const now: number = Date.now();
        await MovementsMutationAPI.create({
          logId,
          name: match.name,
          timestamp: now,
          // Get the sets for this new movement from prior history
          sets:
            previous?.sets.map(s => ({
              ...s,
              status: MovementSetStatus.Unattempted,
              uuid: uuidv4(),
            })) ?? [],
          authorUserId: user.uid,
          savedMovementId: match.id,
          savedMovementName: match.name,
          position,
          isFavorited: false,
          weightUnit: previous?.weightUnit ?? MovementWeightUnit.Pounds,
          repCountUnit: previous?.repCountUnit ?? MovementRepCountUnit.Reps,
          ...overrides,
        });
        // Update lastSeen property if adding movement to an actual log
        if (!isProgramView) await SavedMovementsAPI.update({ id: match.id, lastSeen: now });
        addMovementDrawer.onClose();
        setMovementNameQuery('');
      } catch (error) {
        toast.error(error.message);
      }
    },
    [
      MovementsQueryAPI,
      MovementsMutationAPI,
      addMovementDrawer,
      logId,
      movements,
      savedMovements,
      SavedMovementsAPI,
      toast,
      user.uid,
      isProgramView,
    ]
  );

  const addSetToMovement = useCallback(
    async (movement: Movement): Promise<true | undefined> => {
      // Sets for movements in ProgramLogTemplates must be a rep *range* to
      // match realistic human behavior
      if (isProgramView && newSetRepCountMin === newSetRepCountMax) {
        toast.info('Please give a rep range to better match human behavior.', {
          action: snackbarKey => (
            <Stack direction="row">
              <Button
                onClick={() => {
                  // Minimum is 1, not 0
                  setNewSetRepCountMin(newSetRepCountMin - 5 || 1);
                  setNewSetRepCountMax(newSetRepCountMin + 5);
                  toast.close(snackbarKey);
                }}
              >
                Okay
              </Button>
            </Stack>
          ),
        });
        return;
      }
      try {
        const sets = movement.sets.concat({
          weight: newSetWeight,
          repCountActual: newSetRepCountMax,
          repCountExpected: newSetRepCountMin,
          repCountMaxExpected: newSetRepCountMax,
          status: MovementSetStatus.Unattempted,
          uuid: uuidv4(),
        });
        await MovementsMutationAPI.update({ sets, id: movement.id });
        return true;
      } catch (error) {
        toast.error(error.message);
      }
    },
    [MovementsMutationAPI, isProgramView, newSetRepCountMax, newSetRepCountMin, newSetWeight, toast]
  );

  return (
    <>
      <Stack spacing={2}>
        <DataStateView data={movements}>
          {movements => (
            <Stack
              spacing={3}
              // Block all mouse clicks/events when in readOnly mode
              sx={readOnly ? { '& *': { pointerEvents: 'none' } } : void 0}
            >
              {movements.map(movement => (
                <Stack key={movement.id} sx={{ padding: theme => theme.spacing(1, 0) }}>
                  <Box display="flex" alignItems="end" width="100%" justifyContent="space-between">
                    {/** alignItems here could be END or BASELINE */}
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      width="100%"
                    >
                      <Box display="flex" alignItems="baseline">
                        <Stack
                          sx={{ padding: theme => theme.spacing(0.5, 0.0) }}
                          onClick={async event => {
                            try {
                              movementMenuDrawer.onOpen(event, movement);
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }}
                        >
                          <Typography
                            fontSize="1.4rem"
                            fontWeight={200}
                            sx={{
                              backgroundColor: theme => alpha(theme.palette.divider, 0.02),
                              padding: theme => theme.spacing(0.0, 1.0),
                              borderRadius: 1,
                            }}
                          >
                            {movement.name}
                          </Typography>
                        </Stack>

                        {/** Display volume or reps total. */}
                        {/** Avoids using unit to distinguish weightless/bodyweight as enum variants may change. */}
                        <WithVariable
                          value={movement.sets.filter(
                            _ => _.status === MovementSetStatus.Completed
                          )}
                        >
                          {completedSets => {
                            const completedVol = MovementSet.summate(completedSets);
                            const totalVol = MovementSet.summate(movement.sets);
                            return (
                              <Typography
                                variant="overline"
                                sx={{
                                  color: 'text.secondary',
                                  marginLeft: theme => theme.spacing(1),
                                }}
                              >
                                {!isProgramView && completedVol !== totalVol && (
                                  <>{Intl.NumberFormat().format(completedVol)}/</>
                                )}
                                {Intl.NumberFormat().format(totalVol)}
                              </Typography>
                            );
                          }}
                        </WithVariable>
                      </Box>
                      <IconButton
                        onClick={event => {
                          addSetMenu.onOpen(event, movement);
                          // Set controlled state default values to previous set
                          if (movement.sets.length > 0) {
                            const lastSet = movement.sets[movement.sets.length - 1];
                            setNewSetWeight(lastSet.weight);
                            setNewSetRepCountMin(lastSet.repCountExpected);
                            setNewSetRepCountMax(lastSet?.repCountMaxExpected || DEFAULT_MAX_REPS);
                          } else {
                            setNewSetWeight(0);
                            setNewSetRepCountMin(DEFAULT_MIN_REPS);
                            setNewSetRepCountMax(DEFAULT_MAX_REPS);
                          }
                        }}
                      >
                        <EditOutlined />
                      </IconButton>
                    </Stack>
                  </Box>

                  {DataState.isReady(savedMovements) && (
                    <WithVariable
                      value={savedMovements.find(_ => _.id === movement.savedMovementId)}
                    >
                      {savedMovement =>
                        !savedMovement?.note?.length ? null : (
                          <Typography
                            variant="body1"
                            sx={{ margin: theme => theme.spacing(1) }}
                            fontWeight={200}
                          >
                            {'>'} {savedMovement.note}
                          </Typography>
                        )
                      }
                    </WithVariable>
                  )}

                  <Box width="100%" sx={{ overflowX: 'scroll' }}>
                    <Stack direction="row">
                      {/** Stack of unit control text display */}
                      {movement.sets.length > 0 && (
                        <Stack
                          alignItems="end"
                          sx={{
                            // Spacing away from set blocks
                            paddingRight: theme => theme.spacing(2),
                          }}
                        >
                          <Typography variant="overline" alignSelf="end">
                            {movement.weightUnit}
                          </Typography>

                          <Typography variant="overline" alignSelf="end">
                            {MovementRepCountUnit[movement.repCountUnit]}
                          </Typography>
                        </Stack>
                      )}

                      {movement.sets.map((movementSet, index) => (
                        <MovementSetView
                          key={movementSet.uuid}
                          movementSet={movementSet}
                          movement={movement}
                          index={index}
                          updateSets={async (mSets: MovementSet[]) => {
                            try {
                              // Send changes
                              await MovementsMutationAPI.update({
                                id: movement.id,
                                sets: mSets,
                              });
                            } catch (error) {
                              toast.error(error.message);
                            }
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </DataStateView>

        {DataState.isReady(movements) && !readOnly && (
          <Box display="flex" width="100%" justifyContent="center">
            <Button onClick={event => addMovementDrawer.onOpen(event, null)} size="small">
              <AddRounded
                sx={{
                  color: 'text.secondary',
                  fontSize: '1.5rem',
                  // Move away from everything else
                  mt: 2,
                  mb: 2,
                }}
              />
            </Button>
          </Box>
        )}
      </Stack>

      {/** ------------------------- DRAWERS ------------------------- */}

      <Backdrop open={addSetMenu.open} sx={{ color: '#fff' }}>
        <WithVariable value={addSetMenu.getData()}>
          {movement =>
            movement === null ? null : (
              <Menu
                open={addSetMenu.open}
                anchorEl={addSetMenu.anchorEl}
                onClose={async (_event, reason) => {
                  if (reason === 'backdropClick') {
                    if (newSetRepCountMin === 0) {
                      addSetMenu.onClose();
                      return;
                    }
                    if (newSetRepCountMax < newSetRepCountMin) {
                      toast.error('Maximum must be less than minimum.');
                      return;
                    }
                    const success = await addSetToMovement(movement);
                    if (success) addSetMenu.onClose();
                    return;
                  }
                  // Click was NOT on the backdrop so it was within
                  // the menu which means the user is clicking
                  // around in the menu, so do nothing.
                  return;
                }}
              >
                <Stack spacing={3} sx={{ padding: theme => theme.spacing(1, 3) }}>
                  <Box width="100%" textAlign="center" marginBottom="-1rem">
                    <Typography
                      variant="overline"
                      sx={{ color: theme => theme.palette.primary.main }}
                    >
                      <Collapse
                        in={newSetRepCountMin > 0}
                        onClick={async () => {
                          const success = await addSetToMovement(movement);
                          if (success) addSetMenu.onClose();
                        }}
                      >
                        Tap outside to <b>add set {movement.sets.length + 1}</b>
                      </Collapse>
                      <Collapse in={newSetRepCountMin === 0}>
                        Add Set <b>{movement.sets.length + 1}</b>
                      </Collapse>
                    </Typography>
                  </Box>
                  <Stack direction="row">
                    <Stack spacing={3} marginTop={0.8} marginRight={2}>
                      <MovementUnitSelect
                        value={movement.weightUnit}
                        onChange={async event => {
                          try {
                            const newWeightUnit = event.target.value as MovementWeightUnit;
                            // Update field on the movement
                            const updated: Movement = await MovementsMutationAPI.update({
                              id: movement.id,
                              weightUnit: newWeightUnit,
                            });
                            addSetMenu.setData(updated);
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        <MenuItem value={MovementWeightUnit.Pounds}>
                          {MovementWeightUnit.Pounds}
                        </MenuItem>
                        <MenuItem value={MovementWeightUnit.Kilograms}>
                          {MovementWeightUnit.Kilograms}
                        </MenuItem>
                      </MovementUnitSelect>
                      <MovementUnitSelect
                        value={movement.repCountUnit}
                        onChange={async event => {
                          try {
                            const newRepCountUnit = event.target.value as MovementRepCountUnit;
                            // Update field on the movement
                            const updated: Movement = await MovementsMutationAPI.update({
                              id: movement.id,
                              repCountUnit: newRepCountUnit,
                            });
                            addSetMenu.setData(updated);
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        <MenuItem value={MovementRepCountUnit.Reps}>
                          {MovementRepCountUnit.Reps}
                        </MenuItem>
                        <MenuItem value={MovementRepCountUnit.Seconds}>
                          {MovementRepCountUnit.Seconds}
                        </MenuItem>
                        <MenuItem value={MovementRepCountUnit.Minutes}>
                          {MovementRepCountUnit.Minutes}
                        </MenuItem>
                        <MenuItem value={MovementRepCountUnit.Meters}>
                          {MovementRepCountUnit.Meters}
                        </MenuItem>
                      </MovementUnitSelect>
                    </Stack>
                    <Stack spacing={3}>
                      <Box display="flex">
                        <TextField
                          variant="standard"
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                          value={newSetWeight}
                          onChange={event => setNewSetWeight(+event.target.value)}
                          onFocus={event => event.currentTarget.select()}
                          InputProps={{
                            sx: { fontSize: '1.5rem', width: '60px' },
                          }}
                        />
                        {/** Shortcut buttons to add set with weight as a down set or up set */}
                        <WithVariable value={movement.sets[movement.sets.length - 1]}>
                          {lastSet => {
                            if (!lastSet || lastSet.weight === 0) return null;
                            return (
                              <>
                                <Button
                                  sx={{ color: 'text.secondary' }}
                                  onClick={() => {
                                    let nextWeight = lastSet.weight * 0.75;
                                    // Round to intervals of 5
                                    nextWeight = Math.round(nextWeight / 5) * 5;
                                    setNewSetWeight(nextWeight);
                                  }}
                                >
                                  75%
                                </Button>
                                <Button
                                  sx={{ color: 'text.secondary' }}
                                  onClick={() => {
                                    let nextWeight = lastSet.weight * 1.1;
                                    // Round to intervals of 5
                                    nextWeight = Math.round(nextWeight / 5) * 5;
                                    setNewSetWeight(nextWeight);
                                  }}
                                >
                                  110%
                                </Button>
                              </>
                            );
                          }}
                        </WithVariable>
                      </Box>
                      <Box display="flex">
                        <TextField
                          variant="standard"
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                          value={newSetRepCountMin}
                          onChange={event => {
                            const val = +event.target.value;
                            // auto-set max to min if min > max
                            if (val > newSetRepCountMax) {
                              setNewSetRepCountMax(val);
                            }
                            setNewSetRepCountMin(val);
                          }}
                          onFocus={event => event.currentTarget.select()}
                          InputProps={{
                            sx: { fontSize: '1.5rem', width: '75px' },
                          }}
                        />
                        <TextField
                          variant="standard"
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                          value={newSetRepCountMax}
                          error={newSetRepCountMax < newSetRepCountMin}
                          onChange={event => {
                            const val = +event.target.value;
                            setNewSetRepCountMax(val);
                          }}
                          onFocus={event => event.currentTarget.select()}
                          InputProps={{
                            sx: { fontSize: '1.5rem', width: '75px' },
                            startAdornment: (
                              <Typography variant="body2" color="textSecondary" ml={-3} mr={3}>
                                {DIFF_CHAR}
                              </Typography>
                            ),
                          }}
                        />
                      </Box>
                    </Stack>
                  </Stack>
                  <Stack spacing={2}>
                    <Button
                      size="large"
                      variant="outlined"
                      sx={() => {
                        const bgColor = alpha(colors.amber[500], 0.2);
                        return {
                          color: 'text.secondary',
                          backgroundColor: bgColor,
                          border: `1px solid ${bgColor}`,
                        };
                      }}
                      onClick={addSetMenu.onClose}
                      startIcon={<CloseRounded fontSize="small" />}
                    >
                      Cancel
                    </Button>
                    {movement.sets.length > 0 && (
                      <Button
                        variant="text"
                        sx={{ color: 'text.secondary' }}
                        startIcon={<DeleteOutline fontSize="small" />}
                        onClick={async function deleteLastSet() {
                          let sets = movement.sets.slice();
                          // Remove last element
                          sets.pop();
                          try {
                            await MovementsMutationAPI.update({ id: movement.id, sets });
                            addSetMenu.onClose();
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        Delete Previous Set
                      </Button>
                    )}
                    {movement.sets.length > 1 && (
                      <Button
                        size="small"
                        variant="text"
                        sx={{ color: 'text.secondary' }}
                        startIcon={<DeleteRounded fontSize="small" />}
                        onClick={async function deleteAllSets() {
                          try {
                            await MovementsMutationAPI.update({ id: movement.id, sets: [] });
                            addSetMenu.onClose();
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        Delete All Sets
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Menu>
            )
          }
        </WithVariable>
      </Backdrop>

      <SwipeableDrawer
        {...addMovementDrawer.props()}
        anchor={addMovementDrawer.getData() === null ? 'top' : 'bottom'}
        sx={{ zIndex: theme => theme.zIndex.drawer + 1 }}
        onClose={() => {
          addMovementDrawer.onClose();
          // clear input on close
          setMovementNameQuery('');
        }}
      >
        <Collapse in={addMovementDrawer.open}>
          {/** Top 3-8 recommendations */}

          <Stack spacing={1} key={JSON.stringify(addMovementDrawer)}>
            <Box>
              {/** FocusLock-ed things are in a Box to to prevent bug with Stack spacing. */}
              <ReactFocusLock
                disabled={!addMovementDrawer.open || savedMovementDrawer.open}
                returnFocus
              >
                <TextField
                  fullWidth
                  variant="standard"
                  helperText="Select a movement"
                  value={movementNameQuery}
                  onChange={event => setMovementNameQuery(event.target.value)}
                  InputProps={{
                    endAdornment: !!movementNameQuery && (
                      <IconButton size="small" onClick={() => setMovementNameQuery('')}>
                        <Close />
                      </IconButton>
                    ),
                  }}
                />
              </ReactFocusLock>
            </Box>

            <DataStateView data={matches}>
              {matches => {
                const queryIsEmpty = movementNameQuery === '';
                const query = movementNameQuery.toLowerCase();
                const hasFoundExactName = matches.some(_ => _.name === query);
                const hasFuzzyNameMatch = matches.some(_ => _.name.toLowerCase().includes(query));
                const isReplacingMovement = !!addMovementDrawer.getData();
                return (
                  <>
                    {matches.length > 0 && (
                      <Collapse in={queryIsEmpty || hasFuzzyNameMatch}>
                        <Stack spacing={1.25} sx={{ maxHeight: '40vh', overflowY: 'scroll' }}>
                          {matches.map((match: SavedMovement) => {
                            const distance = formatDistanceToNowStrict(new Date(match.lastSeen), {
                              addSuffix: true,
                            })
                              .replace(/ (\w)\w+ /i, '$1 ')
                              .replace('m ', 'mo ');
                            const isLessThan72HoursAgo =
                              new Date().getTime() - new Date(match.lastSeen).getTime() <
                              72 * 60 * 60 * 1000;
                            return (
                              <Box key={match.id} display="flex" justifyContent="space-between">
                                <Typography
                                  sx={{
                                    padding: theme => theme.spacing(0.5, 1.25),
                                    borderRadius: 1,
                                    border: '1px solid lightgrey',
                                  }}
                                  onClick={async () => {
                                    const movement = addMovementDrawer.getData();
                                    if (movement === null) {
                                      addMovementFromExistingSavedMovement(match);
                                      return;
                                    }
                                    if (!DataState.isReady(movements)) return;
                                    if (movements.some(_ => _.savedMovementId === match.id)) {
                                      toast.info(`${match.name} has already been added.`);
                                      return;
                                    }
                                    const { position } = movement;
                                    try {
                                      await Promise.all([
                                        MovementsMutationAPI.delete(movement.id),
                                        addMovementFromExistingSavedMovement(match, { position }),
                                      ]);
                                      movementMenuDrawer.onClose();
                                      toast.info('Movement replaced.');
                                    } catch (error) {
                                      toast.error(error.message);
                                    }
                                  }}
                                >
                                  {match.name}
                                </Typography>
                                <Box sx={{ whiteSpace: 'nowrap' }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: theme =>
                                        isLessThan72HoursAgo
                                          ? theme.palette.text.secondary
                                          : theme.palette.success.main,
                                      filter: 'grayscale(30%)',
                                    }}
                                  >
                                    {distance}
                                  </Typography>
                                  <IconButton
                                    sx={{ color: theme => theme.palette.text.secondary }}
                                    onClick={async event => {
                                      try {
                                        savedMovementDrawer.onOpen(event, match);
                                      } catch (err) {
                                        toast.error(err.message);
                                      }
                                    }}
                                  >
                                    <MoreHoriz fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Collapse>
                    )}
                    <Collapse in={!queryIsEmpty && !hasFoundExactName && !isReplacingMovement}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: theme => theme.spacing(0),
                        }}
                      >
                        <Button
                          fullWidth
                          size="large"
                          sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                          startIcon={<Add />}
                          onClick={addMovementFromNewSavedMovement}
                        >
                          Create {movementNameQuery}
                        </Button>
                      </Box>
                    </Collapse>
                  </>
                );
              }}
            </DataStateView>
          </Stack>
        </Collapse>
      </SwipeableDrawer>

      {/** SavedMovement Update + Delete Drawer with History tab */}
      <SwipeableDrawer
        {...savedMovementDrawer.props()}
        anchor="top"
        onClose={() => {
          // Reset back to original
          setTabValue(TabIndex.Edit);
          savedMovementDrawer.onClose();
        }}
      >
        <Collapse in={savedMovementDrawer.open}>
          <Box
            width="100%"
            justifyContent="center"
            alignItems="center"
            display="flex"
            sx={{ marginTop: '-1rem' }}
          >
            <Tabs
              variant="fullWidth"
              value={tabValue}
              onChange={(_, next) => setTabValue(next)}
              aria-label="tabs"
            >
              <Tab label="EDIT" {...tabA11yProps(TabIndex.Edit)} />
              <Tab label="HISTORY" {...tabA11yProps(TabIndex.History)} />
            </Tabs>
          </Box>
          <TabPanel value={tabValue} index={TabIndex.Edit}>
            <Stack spacing={1} key={JSON.stringify(savedMovementDrawer)}>
              <Box>
                <ReactFocusLock disabled={!savedMovementDrawer.open} returnFocus>
                  <TextField
                    fullWidth
                    variant="standard"
                    label="Saved Movement Name"
                    defaultValue={savedMovementDrawer.getData()?.name}
                    // Avoiding controlled state this way with onBlur
                    onBlur={async function editSavedMovement(event) {
                      try {
                        const savedMovement = savedMovementDrawer.getData();
                        if (!savedMovement) return;
                        const newName = event.target.value;
                        if (newName.length < 3 || newName === savedMovement.name) {
                          return;
                        }
                        await SavedMovementsAPI.update({
                          id: savedMovement.id,
                          name: newName,
                        });
                        savedMovementDrawer.onClose();
                      } catch (error) {
                        toast.error(error.message);
                      }
                    }}
                  />
                </ReactFocusLock>
              </Box>
              <Box>
                <Button
                  color="error"
                  startIcon={<DeleteForeverRounded />}
                  onClick={async function deleteSavedMovement() {
                    try {
                      if (!window.confirm('Are you sure you want to delete this?')) return;
                      const savedMovement = savedMovementDrawer.getData();
                      if (!savedMovement) throw Error('Unreachable: deleteSavedMovement');
                      await SavedMovementsAPI.delete(savedMovement.id);
                      savedMovementDrawer.onClose();
                      toast.info(`Deleted ${savedMovement.name}`);
                    } catch (error) {
                      toast.error(error.message);
                    }
                  }}
                >
                  Delete
                </Button>
              </Box>
            </Stack>
          </TabPanel>
          <TabPanel value={tabValue} index={TabIndex.History}>
            <WithVariable value={savedMovementDrawer.getData()}>
              {savedMovement =>
                savedMovement === null ? null : (
                  <SavedMovementHistory
                    savedMovement={savedMovement}
                    openLogDrawer={historyLogDrawer.onOpen}
                  />
                )
              }
            </WithVariable>
          </TabPanel>
        </Collapse>
      </SwipeableDrawer>

      {/** In-editor display of editor from the TrainingLog from the movement from the SavedMovement history. */}
      <SwipeableDrawer {...historyLogDrawer.props()} anchor="bottom">
        <Collapse in={historyLogDrawer.open}>
          <Box height="80vh">
            <WithVariable value={historyLogDrawer.getData()}>
              {movement => {
                if (!movement) return null;
                return (
                  <Stack spacing={0.5}>
                    <Typography variant="overline" width="100%" textAlign="center" sx={{ mt: -1 }}>
                      {dateDisplay(new Date(movement.timestamp))}
                    </Typography>
                    <EditorInternals readOnly logId={movement.logId} />
                  </Stack>
                );
              }}
            </WithVariable>
          </Box>
        </Collapse>
      </SwipeableDrawer>

      {/** Movement Menu Drawer */}
      <SwipeableDrawer
        open={movementMenuDrawer.open}
        anchor="top"
        onOpen={movementMenuDrawer.props().onOpen}
        onClose={async function reorderMovements() {
          const movement = movementMenuDrawer.getData();
          if (!DataState.isReady(movements)) return;
          if (movementOrderSwap && movement) {
            // movement is the movement clicked
            // movementOrderSwap is the movement being moved
            const sourceMv = movement;
            const sourceIndex = movements.indexOf(sourceMv);
            const targetMv = movementOrderSwap;
            const targetIndex = movements.indexOf(targetMv);
            let updates: Promise<Movement>[] = [];
            if (sourceMv.position > targetMv.position) {
              // take items between and move them up
              updates = movements
                .slice(targetIndex, sourceIndex + 1)
                .map(m => MovementsMutationAPI.update({ id: m.id, position: m.position + 1 }));
            } else {
              // take items between and move them down
              updates = movements
                .slice(sourceIndex + 1, targetIndex + 1)
                .map(m => MovementsMutationAPI.update({ id: m.id, position: m.position - 1 }));
            }
            // move source to desired destination
            updates.push(
              MovementsMutationAPI.update({ id: sourceMv.id, position: targetMv.position })
            );
            try {
              await Promise.all(updates);
            } catch (error) {
              toast.error(error.message);
            }
          }
          movementMenuDrawer.onClose();
          setMovementOrderSwap(null);
        }}
      >
        <Collapse in={movementMenuDrawer.open}>
          <Box
            width="100%"
            justifyContent="center"
            alignItems="center"
            display="flex"
            sx={{ marginTop: '-1rem' }}
          >
            <Tabs
              variant="fullWidth"
              value={tabValue}
              onChange={(_, next) => setTabValue(next)}
              aria-label="tabs"
            >
              <Tab label="EDIT" {...tabA11yProps(TabIndex.Edit)} />
              <Tab label="HISTORY" {...tabA11yProps(TabIndex.History)} />
            </Tabs>
          </Box>
          <TabPanel value={tabValue} index={TabIndex.Edit}>
            <Stack spacing={2} key={JSON.stringify(movementMenuDrawer)}>
              <Box>
                <TextField
                  fullWidth
                  variant="standard"
                  label="Movement Name"
                  defaultValue={movementMenuDrawer.getData()?.name}
                  onBlur={async function editMovement(event) {
                    try {
                      const movement = movementMenuDrawer.getData();
                      if (!movement) return;
                      const newName = event.target.value;
                      if (newName.length < 3 || newName === movement.name) {
                        return;
                      }
                      await MovementsMutationAPI.update({
                        id: movement.id,
                        name: newName,
                      });
                      movementMenuDrawer.onClose();
                      toast.info(`Movement renamed to ${newName}`);
                    } catch (error) {
                      toast.error(error.message);
                    }
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  color="error"
                  startIcon={<DeleteOutline />}
                  onClick={async () => {
                    if (!window.confirm('Are you sure?')) return;
                    try {
                      const movement = movementMenuDrawer.getData();
                      if (!movement) throw TypeError('Unreachable: rename movement');
                      await MovementsMutationAPI.delete(movement.id);
                      movementMenuDrawer.onClose();
                    } catch (error) {
                      toast.error(error.message);
                    }
                  }}
                >
                  Remove
                </Button>
                <Button
                  sx={{ color: theme => theme.palette.text.secondary }}
                  startIcon={<FindReplaceRounded />}
                  onClick={event => {
                    const movement = movementMenuDrawer.getData();
                    if (!movement) throw Error('Unreachable: Movement not found.');
                    addMovementDrawer.onOpen(event, movement);
                  }}
                >
                  Replace
                </Button>
              </Box>

              {/** Re-order / position buttons */}
              <DataStateView data={movements}>
                {movements => {
                  if (movements.length <= 1) return null;
                  const selectedMovement = movementMenuDrawer.getData();
                  if (!selectedMovement) return null;
                  return (
                    <Stack
                      spacing={1.5}
                      direction="row"
                      alignItems="center"
                      sx={{ overflowX: 'scroll' }}
                    >
                      <Typography variant="subtitle2">Order:</Typography>
                      {movements.map((movement, movementIndex) => {
                        const isSelected = movement.position === movementOrderSwap?.position;
                        return (
                          <Button
                            id={movement.id}
                            key={movement.id}
                            variant={isSelected ? 'contained' : 'outlined'}
                            disabled={selectedMovement.id === movement.id}
                            onClick={() => {
                              if (isSelected) {
                                // Unselect.
                                setMovementOrderSwap(null);
                              } else {
                                setMovementOrderSwap(movement);
                              }
                            }}
                            // https://uxmovement.com/mobile/optimal-size-and-spacing-for-mobile-buttons/
                            sx={{ minWidth: '48px' }}
                          >
                            <b>{movementIndex + 1}</b>
                          </Button>
                        );
                      })}
                    </Stack>
                  );
                }}
              </DataStateView>

              {/** Edit note for SavedMovement */}
              {DataState.isReady(savedMovements) && (
                <WithVariable
                  value={savedMovements.find(
                    m => m.id === movementMenuDrawer.getData()?.savedMovementId
                  )}
                >
                  {savedMovement => {
                    if (!savedMovement) return null;
                    return (
                      <NotesDrawer
                        noFocusLock
                        note={savedMovement?.note || ''}
                        sx={{ height: '16vh' }}
                        onBlur={async (nextNote: string) => {
                          try {
                            // Update SavedMovement with new note
                            await SavedMovementsAPI.update({
                              id: savedMovement.id,
                              note: nextNote,
                            });
                          } catch (err) {
                            toast.error(err.message);
                          }
                        }}
                      />
                    );
                  }}
                </WithVariable>
              )}
            </Stack>
          </TabPanel>
          <TabPanel value={tabValue} index={TabIndex.History}>
            <WithVariable value={movementMenuDrawer.getData()}>
              {movement =>
                movement === null ? null : (
                  <SavedMovementHistory
                    savedMovement={{
                      id: movement.savedMovementId,
                      name: movement.savedMovementName,
                    }}
                    openLogDrawer={historyLogDrawer.onOpen}
                  />
                )
              }
            </WithVariable>
          </TabPanel>
        </Collapse>
      </SwipeableDrawer>
    </>
  );
};

const MovementSetView: FC<{
  movementSet: MovementSet;
  movement: Movement;
  index: number;
  updateSets(mSets: MovementSet[]): Promise<void>;
}> = ({ movementSet, movement, updateSets, index }) => {
  const resizeWeightInput = useResizableInputRef();
  const theme = useTheme();

  const [weight, setWeight] = useState(movementSet.weight);
  const [confetti, setConfetti] = useState(false);

  const setIsCompleted = movementSet.status === MovementSetStatus.Completed;

  const dynamicRepCountButtonStyle = useMemo(
    () =>
      movementSet.status === MovementSetStatus.Completed
        ? {
            backgroundColor: alpha(theme.palette.success.light, 0.07),
            // Avoid jarring when switching between Unattempted and Completed
            borderBottom: `3px solid ${theme.palette.success.light}`,
            color: theme.palette.success.light,
          }
        : {
            backgroundColor: alpha(theme.palette.divider, 0.04),
            borderBottom: `3px solid ${theme.palette.divider}`,
          },
    [movementSet.status, theme]
  );

  return (
    <Stack>
      <input
        ref={resizeWeightInput}
        type="tel"
        min={0}
        max={9999}
        name="weight"
        value={weight}
        onFocus={event => {
          event.currentTarget.select();
        }}
        onChange={event => {
          if (Number.isNaN(event.target.value)) return;
          setWeight(Number(event.target.value));
        }}
        onBlur={event => {
          if (Number.isNaN(event.target.value)) {
            throw Error('Unreachable: weight input is NaN');
          }
          const value = +event.target.value;
          let next = movement.sets.slice();
          // Cascade new weight value to sets after this one if this weight = 0
          if (movementSet.weight === 0 && index < next.length - 1) {
            next.slice(index + 1).forEach(_ => {
              _.weight = value;
              _.uuid = uuidv4();
            });
          }
          next[index].weight = value;
          updateSets(next);
        }}
        style={{
          height: '100%',
          color:
            movementSet.status === MovementSetStatus.Unattempted
              ? theme.palette.text.secondary
              : theme.palette.success.light,
          backgroundColor: 'transparent',
          width: '3ch',
          border: 'none',
          outline: 'none',
          margin: '0 auto',
          padding: '2px 4px',
          fontFamily: 'monospace',
          fontWeight: 500,
          fontSize: '1.2rem',
          letterSpacing: '0.004em',
        }}
      />

      <Select
        // Handles dynamic styling based on repCount button for a movement set
        style={dynamicRepCountButtonStyle}
        sx={{
          borderRadius: 1,
          whiteSpace: 'nowrap',
        }}
        disableUnderline
        variant="standard"
        SelectDisplayProps={{
          style: {
            padding: `10px ${
              setIsCompleted && movementSet.repCountActual.toString().length > 1 ? '15px' : '20px'
            }`,
            textAlign: 'center',
            fontSize: '1.5rem',
            minHeight: 'auto',
          },
        }}
        IconComponent={() => null}
        value={movementSet.repCountActual}
        inputProps={{
          id: movementSet.uuid,
        }}
        // This onClose catches when the user selects the rep value that is the
        // same value as the repCountMaxExpected (which onChange does not
        // catch, since that is apparently not considered a _change_).
        onClose={() => {
          const el = document.getElementById(movementSet.uuid);
          if (!(el instanceof HTMLInputElement) || Number.isNaN(+el?.value)) {
            return;
          }
          const value = +el.value;
          if (movementSet.repCountMaxExpected !== value) return;
          if (movementSet.status === MovementSetStatus.Unattempted) {
            movement.sets[index].status = MovementSetStatus.Completed;
            updateSets([...movement.sets]);
          }
        }}
        onChange={async event => {
          const { repCountMaxExpected } = movementSet;
          const value = event.target.value;
          if (Number.isNaN(+value) && value === 'RESET') {
            // reset to OG value
            movement.sets[index].status = MovementSetStatus.Unattempted;
            movement.sets[index].repCountActual = repCountMaxExpected;
          } else {
            // update to new value
            movement.sets[index].repCountActual = +value;
            movement.sets[index].status = MovementSetStatus.Completed;
            const isLastSet = index === movement.sets.length - 1;
            if (Math.random() > 0.85 && isLastSet) {
              setConfetti(true);
            }
          }
          updateSets([...movement.sets]);
        }}
        renderValue={value =>
          typeof movementSet.repCountMaxExpected === 'undefined' ||
          movementSet.status === MovementSetStatus.Completed ||
          movementSet.repCountExpected === movementSet.repCountMaxExpected ? (
            value.toString()
          ) : (
            <Typography>
              {movementSet.repCountExpected} {DIFF_CHAR.toLowerCase()}{' '}
              {movementSet.repCountMaxExpected}
            </Typography>
          )
        }
      >
        <MenuItem value={'RESET'}>
          <RefreshRounded sx={{ mr: 1.5, color: theme => theme.palette.text.secondary }} />{' '}
          {movementSet.repCountExpected} {DIFF_CHAR.toLowerCase()} {movementSet.repCountMaxExpected}
        </MenuItem>
        {/** Completed set choices: Choice of reps from 0 to repCountMaxExpected + N */}
        {Array.from({ length: movementSet.repCountMaxExpected + 6 })
          .map((_, i) => i)
          .reverse()
          .map(i => (
            <MenuItem value={i} key={i} sx={{ justifyContent: 'space-between' }}>
              <CheckRounded sx={{ opacity: 0.5, color: theme => theme.palette.success.main }} />
              {i}
            </MenuItem>
          ))}
      </Select>
      {confetti && <ConfettiExplosion particleCount={150} width={500} force={0.6} />}
    </Stack>
  );
};

const MovementUnitSelect: FC<{ children: ReactNode } & Pick<SelectProps, 'value' | 'onChange'>> = ({
  children,
  value,
  onChange,
}) => (
  <Select
    // Make the select look like a text button
    disableUnderline
    variant="standard"
    SelectDisplayProps={{
      style: {
        padding: '8px 11px',
      },
    }}
    sx={{
      width: '100%',
      textAlign: 'right',
      textTransform: 'uppercase',
      border: theme => `1px solid ${theme.palette.divider}`,
      borderRadius: 1,
      fontSize: '0.8rem',
    }}
    IconComponent={() => null}
    value={value}
    onChange={onChange}
  >
    {children}
  </Select>
);

const SavedMovementHistory: FC<{
  savedMovement: Pick<SavedMovement, 'id' | 'name'>;
  openLogDrawer: (event: React.MouseEvent<HTMLElement>, movement: Movement) => void;
}> = ({ savedMovement, openLogDrawer }) => {
  const movementsHistory = useStore(store => store.useMovementsHistory(savedMovement.id));

  if (!DataState.isReady(movementsHistory)) return null;

  let heaviest = 0;
  let heaviestDate: Date | null = null;
  for (const movement of movementsHistory) {
    for (const set of movement.sets) {
      if (set.weight > heaviest) {
        heaviest = set.weight;
        heaviestDate = new Date(movement.timestamp);
      }
    }
  }

  return (
    <Stack spacing={1}>
      <Typography variant="h6" fontWeight="bold">
        {savedMovement.name}
      </Typography>
      {/** Graph of volume over time, w/ dates */}
      {!!heaviest && !!heaviestDate && (
        <Typography variant="caption">
          Heaviest was {heaviest}
          {movementsHistory[0].weightUnit} on {dateDisplay(heaviestDate)}.
        </Typography>
      )}
      {/** List of movement items w/ links to open Editor in drawer */}
      <Paper elevation={3}>
        <Stack
          spacing={1}
          sx={{
            maxHeight: '40vh',
            overflowY: 'scroll',
            '& > *:not(:last-child)': {
              borderBottom: theme => `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          {movementsHistory.map((movement, index, { length }) => {
            const date = new Date(movement.timestamp);
            return (
              <Stack
                key={movement.id}
                spacing={2}
                direction="row"
                justifyContent="space-between"
                width="100%"
                alignItems="center"
                onClick={event => openLogDrawer(event, movement)}
                sx={{ padding: theme => theme.spacing(1.5) }}
              >
                <Stack direction="row" alignItems="baseline" spacing={2}>
                  <Typography variant="overline" color="textSecondary" alignSelf="center">
                    {length - index}
                  </Typography>
                  <Stack>
                    <Typography variant="body2" height="100%">
                      {dateDisplay(date)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Order: {movement.position}
                      {ordinalSuffix(movement.position)}
                    </Typography>
                  </Stack>
                </Stack>
                <Typography variant="overline">
                  {Intl.NumberFormat().format(
                    MovementSet.summate(
                      movement.sets.filter(s => s.status === MovementSetStatus.Completed)
                    )
                  )}{' '}
                  {movement.sets?.[0]?.weight === 0 ? movement.repCountUnit : movement.weightUnit}
                </Typography>
                <Stack direction="row" display="flex" alignItems="center" spacing={2}>
                  <Typography variant="body2">
                    {formatDistanceToNowStrict(date, {
                      addSuffix: true,
                    })
                      .replace(/ (\w)\w+ /i, '$1 ')
                      .replace('m ', 'mo ')}
                  </Typography>
                  <NavigateNextRounded />
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
};

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
  MoreHoriz,
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
import { getCountFromServer, limit, orderBy, query, where } from 'firebase/firestore';
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate, useParams } from 'react-router-dom';

import { API } from '../api';
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
  Paths,
  useDataState,
  useDrawer,
  useMaterialMenu,
  useProgramUser,
  useResizableInputRef,
  useToast,
} from '../util';

const DIFF_CHAR = 'to';

/**
 * Wrapper page for editing training entries.
 */
export const Editor: FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { logId } = useParams<{ logId: string }>();
  const { anchorEl: _0, ...logDrawer } = useDrawer<undefined>();
  const notesDrawer = useDrawer<TrainingLog>();
  const [programUser] = useProgramUser();

  const [confetti, setConfetti] = useState(false);

  const [log, setLog] = useDataState(async () => {
    if (!logId) return DataState.Empty;
    return API.TrainingLogs.get(logId);
  }, [logId]);

  const [movements] = useDataState<Movement[]>(async () => {
    if (!logDrawer.open || !logId) return DataState.Empty;
    return API.Movements.getAll(where('logId', '==', logId));
  }, [logDrawer.open, logId]);

  const finishTrainingLog = useCallback(async () => {
    if (!logId) {
      toast.error('Log not found');
      return;
    }
    try {
      const updated = await API.TrainingLogs.update({
        id: logId,
        isFinished: true,
      });
      setLog(updated);
    } catch (err) {
      toast.error(err.message);
    }
  }, [logId, toast, setLog]);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        overflowY: 'scroll',
        padding: theme => theme.spacing(0.5, 2, 3, 2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between" alignItems="center">
        <DataStateView data={DataState.all(log, programUser)}>
          {([log, programUser]) => (
            <Stack>
              <Typography variant="caption" color="textSecondary">
                {dateDisplay(new Date(log.timestamp))}
              </Typography>
              {log.programId === programUser.activeProgramId && (
                <Typography
                  variant="overline"
                  sx={{ color: theme => theme.palette.success.main, fontStyle: 'italic' }}
                >
                  {programUser.activeProgramName}
                </Typography>
              )}
            </Stack>
          )}
        </DataStateView>
        <IconButton onClick={event => logDrawer.onOpen(event, void 0)}>
          <ShortTextRounded sx={{ color: 'text.primary' }} />
        </IconButton>
      </Box>

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
                    const updated = await API.TrainingLogs.update({
                      id: log.id,
                      bodyweight: newBodyweight,
                    });
                    setLog(updated);
                    toast.success('Updated bodyweight.');
                  } catch (error) {
                    toast.error(error.message);
                  }
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <Button
                variant="outlined"
                onClick={async () => {
                  if (!DataState.isReady(movements)) return;
                  const allSetsDone = movements.every(m =>
                    m.sets.every(s => s.status === MovementSetStatus.Completed)
                  );
                  if (allSetsDone) {
                    await finishTrainingLog();
                    setConfetti(true);
                    const word = Math.random() > 0.5 ? 'effort' : 's**t';
                    toast.success(`Good ${word}! I mean, congrations!!`);
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
                    await Promise.all([
                      API.TrainingLogs.delete(logId),
                      API.Movements.deleteMany(where('logId', '==', logId)),
                    ]);
                    logDrawer.onClose();
                    navigate(Paths.home);
                    toast.success('Deleted training.');
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
                  const updated = await API.TrainingLogs.update({
                    id: log.id,
                    note: next,
                  });
                  setLog(updated);
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
  const addMovementDrawer = useMaterialMenu();
  const addSetMenu = useDrawer<Movement>();
  const { anchorEl: _0, ...savedMovementDrawer } = useDrawer<SavedMovement>();
  const { anchorEl: _1, ...movementMenuDrawer } = useDrawer<Movement>();
  /** Holds the ID of the trainingLog attached to the inspected movement history. */
  const { anchorEl: _2, ...historyLogDrawer } = useDrawer<Movement>();

  /** Controlled state of the Add Movement input. */
  const [movementNameQuery, setMovementNameQuery] = useState('');
  /** Controlled state of the Add Set inputs. */
  const [newSetWeight, setNewSetWeight] = useState(0);
  const [newSetRepCountMin, setNewSetRepCountMin] = useState(0);
  const [newSetRepCountMax, setNewSetRepCountMax] = useState(0);
  /** State for re-ordering the list of movements. Holds the Movement to swap places with. */
  const [movementOrderSwap, setMovementOrderSwap] = useState<null | Movement>(null);
  /** For SavedMovement edit/update menu. */
  const [tabValue, setTabValue] = useState(TabIndex.Edit);

  /** The active collection, based on the usage of this component. */
  const Movements = useMemo(
    () => (isProgramView ? API.ProgramMovements : API.Movements),
    [isProgramView]
  );

  /** List of movements for this log. */
  const [movements, setMovements, refetchMovements] = useDataState<Movement[]>(async () => {
    if (logId) {
      return Movements.getAll(where('logId', '==', logId), orderBy('position', 'asc'));
    }
    return DataState.Empty;
  }, [logId]);

  /** List of saved movements from this users collection. */
  const [savedMovements, setSavedMovements] = useDataState<SavedMovement[]>(async () => {
    const savedMovements = await API.SavedMovements.getAll(user.uid);
    const countPromises = savedMovements.map(_ =>
      getCountFromServer(query(API.collections.movements, where('savedMovementId', '==', _.id)))
    );
    const counts = (await Promise.all(countPromises)).map(_ => _.data().count);
    // Sort by frequency and recency.
    return savedMovements
      .map((sm, index) => Object.assign(sm, { count: counts[index] }))
      .sort((a, b) => b.count - a.count)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }, [user.uid]);

  /** A subset of `savedMovements`. */
  // debounced movementNameQuery fetch/search for SavedMovements in the DB
  const [matches, setMatches] = useState<DataState<SavedMovement[]>>(DataState.Empty);
  useEffect(() => {
    if (!DataState.isReady(savedMovements)) {
      return;
    }
    if (movementNameQuery === '') {
      // No search input, so show all SavedMovements
      setMatches(savedMovements);
      // Do not fetch, there is no query to search for
      return;
    }
    // if (!(DataState.isReady(matches) && matches.length > 0)) {
    //   setMatches(DataState.Loading);
    // }
    const timeout = setTimeout(async () => {
      try {
        const query = movementNameQuery.toLowerCase();
        const list: SavedMovement[] = savedMovements.filter(m =>
          m.name.toLowerCase().includes(query)
        );
        setMatches(list);
      } catch (err) {
        toast.error(err.message);
        setMatches(DataState.error(err.message));
      }
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementNameQuery, savedMovements]);

  const addMovementFromNewSavedMovement = useCallback(async () => {
    if (!logId) {
      throw TypeError('Unreachable: logId is required');
    }
    if (!DataState.isReady(movements)) {
      return;
    }
    try {
      const timestamp: number = Date.now();
      const newSavedMovement: SavedMovement = await API.SavedMovements.create({
        note: '',
        name: movementNameQuery,
        authorUserId: user.uid,
        lastSeen: timestamp,
      });
      const position = movements.length > 0 ? movements[movements.length - 1].position + 1 : 0;
      const newMovement: Movement = await Movements.create({
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
      // Update local state to reflect DB changes
      setMovements(_ => DataState.map(_, prev => prev.concat(newMovement)));
      setSavedMovements(_ => DataState.map(_, prev => prev.concat(newSavedMovement)));
      // Close the drawer
      addMovementDrawer.onClose();
      // Clear the input
      setMovementNameQuery('');
    } catch (error) {
      toast.error(error.message);
    }
  }, [
    Movements,
    movements,
    logId,
    movementNameQuery,
    user.uid,
    setMovements,
    setSavedMovements,
    addMovementDrawer,
    toast,
  ]);

  const addMovementFromExistingSavedMovement = useCallback(
    async (match: SavedMovement) => {
      if (!logId) {
        throw Error('Unreachable: logId is required');
      }
      if (!DataState.isReady(movements)) return;
      if (!DataState.isReady(savedMovements)) return;
      try {
        /** The movement data from the last time the user performed this movement. */
        const [previous] = await Movements.getAll(
          where('savedMovementId', '==', match.id),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const position = movements.length > 0 ? movements[movements.length - 1].position + 1 : 0;
        const now: number = Date.now();
        // Create a Movement from the match
        const newMovement: Movement = await Movements.create({
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
        });
        // Update lastSeen property if adding movement to an actual log
        if (!isProgramView) {
          await API.SavedMovements.update({
            id: match.id,
            lastSeen: now,
          });
        }
        // Update local state from DB
        setMovements(DataState.map(movements, prev => prev.concat(newMovement)));
        const next = savedMovements.slice();
        next[next.indexOf(match)].lastSeen = now;
        setSavedMovements(next);
        // Close the drawer
        addMovementDrawer.onClose();
        // Clear the input
        setMovementNameQuery('');
      } catch (error) {
        toast.error(error.message);
      }
    },
    [
      Movements,
      addMovementDrawer,
      logId,
      movements,
      savedMovements,
      setMovements,
      setSavedMovements,
      toast,
      user.uid,
      isProgramView,
    ]
  );

  const addSetToMovement = useCallback(
    async (movement: Movement) => {
      if (!DataState.isReady(movements)) return;
      try {
        // Add new set to list of sets for this Movement
        const sets = movement.sets.concat({
          weight: newSetWeight,
          repCountActual: newSetRepCountMax,
          repCountExpected: newSetRepCountMin,
          repCountMaxExpected: newSetRepCountMax,
          status: MovementSetStatus.Unattempted,
          uuid: uuidv4(),
        });
        const updated: Movement = await Movements.update({
          sets,
          id: movement.id,
        });
        // Update local state
        const copy = movements.slice();
        copy[copy.indexOf(movement)] = updated;
        setMovements(copy);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [Movements, movements, newSetRepCountMax, newSetRepCountMin, newSetWeight, setMovements, toast]
  );

  return (
    <>
      <Stack spacing={2}>
        <DataStateView data={movements}>
          {movements => (
            <Stack
              spacing={3}
              sx={
                // Block all mouse clicks/evets when in readOnly mode
                readOnly ? { '& *': { pointerEvents: 'none' } } : void 0
              }
            >
              {movements.map((movement: Movement, movementIndex) => (
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
                          sx={{ padding: theme => theme.spacing(0.5, 0.5, 0.5, 0.5) }}
                          onClick={event => movementMenuDrawer.onOpen(event, movement)}
                        >
                          <Typography fontSize="1.1rem" fontWeight={600}>
                            {movement.name}
                          </Typography>
                          {isProgramView && (
                            <Typography variant="caption" color="textSecondary">
                              Added{' '}
                              {formatDistanceToNowStrict(new Date(movement.timestamp), {
                                addSuffix: true,
                              })
                                .replace(/ (\w)\w+ /i, '$1 ')
                                .replace('m ', 'mo ')}
                            </Typography>
                          )}
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
                            setNewSetRepCountMax(lastSet?.repCountMaxExpected || 0);
                          } else {
                            setNewSetWeight(0);
                            setNewSetRepCountMin(0);
                            setNewSetRepCountMax(0);
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
                          <Paper elevation={1} sx={{ marginBottom: theme => theme.spacing(1) }}>
                            <Typography variant="body2" sx={{ margin: theme => theme.spacing(1) }}>
                              {savedMovement.note}
                            </Typography>
                          </Paper>
                        )
                      }
                    </WithVariable>
                  )}

                  <Box width="100%" sx={{ overflowX: 'scroll' }}>
                    <Stack direction="row" spacing={2.0}>
                      {/** Stack of unit control text display */}
                      {movement.sets.length > 0 && (
                        <Stack
                          alignItems="end"
                          sx={{ margin: theme => theme.spacing(0, -0.5, 0, 0) }}
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
                              const updated = await Movements.update({
                                id: movement.id,
                                sets: mSets,
                              });
                              // Update local state
                              const copy = movements.slice();
                              copy[movementIndex] = updated;
                              setMovements(copy);
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
            <Button onClick={addMovementDrawer.onOpen} size="small">
              <AddRounded
                sx={{
                  color: 'text.secondary',
                  fontSize: '1.6rem',
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
                onClose={(_event, reason) => {
                  if (reason === 'backdropClick') {
                    if (newSetRepCountMin === 0) {
                      addSetMenu.onClose();
                      return;
                    }
                    if (newSetRepCountMax < newSetRepCountMin) {
                      toast.error('Maximum must be less than minimum.');
                      return;
                    }
                    addSetToMovement(movement);
                    addSetMenu.onClose();
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
                        onClick={() => {
                          addSetToMovement(movement);
                          addSetMenu.onClose();
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
                            const updated: Movement = await Movements.update({
                              id: movement.id,
                              weightUnit: newWeightUnit,
                            });
                            if (!DataState.isReady(movements)) {
                              return;
                            }
                            addSetMenu.setData(updated);
                            // Update local state
                            const copy = movements.slice();
                            copy[copy.indexOf(movement)] = updated;
                            setMovements(copy);
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
                            const updated: Movement = await Movements.update({
                              id: movement.id,
                              repCountUnit: newRepCountUnit,
                            });
                            if (!DataState.isReady(movements)) {
                              return;
                            }
                            addSetMenu.setData(updated);
                            // Update local state
                            const copy = movements.slice();
                            copy[copy.indexOf(movement)] = updated;
                            setMovements(copy);
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
                      sx={{ color: 'text.secondary', backgroundColor: 'divider', border: 0 }}
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
                        onClick={async function deleteSet() {
                          try {
                            const last = movement.sets[movement.sets.length - 1];
                            if (!last) throw TypeError('Unreachable: last');
                            const updated: Movement = await Movements.update({
                              sets: movement.sets.filter(_ => _.uuid !== last.uuid),
                              id: movement.id,
                            });
                            if (!DataState.isReady(movements)) return;
                            // Update local state
                            const copy = movements.slice();
                            copy[copy.indexOf(movement)] = updated;
                            setMovements(copy);
                            // Close the menu
                            addSetMenu.onClose();
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        Delete Set
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
                            const updated: Movement = await Movements.update({
                              sets: [],
                              id: movement.id,
                            });
                            if (!DataState.isReady(movements)) return;
                            // Update local state
                            const copy = movements.slice();
                            copy[copy.indexOf(movement)] = updated;
                            setMovements(copy);
                            // Close the menu
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
        {...addMovementDrawer}
        anchor="top"
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
                  helperText="Select a movement or create one"
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
                                  onClick={() => addMovementFromExistingSavedMovement(match)}
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
                                      // fontWeight: isLessThan72HoursAgo ? 'normal' : 'bold',
                                      filter: 'grayscale(30%)',
                                    }}
                                  >
                                    {distance}
                                  </Typography>
                                  <IconButton
                                    sx={{ color: theme => theme.palette.text.secondary }}
                                    onClick={event => {
                                      savedMovementDrawer.onOpen(event, match);
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
                    <Collapse in={!queryIsEmpty && !hasFoundExactName}>
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
          savedMovementDrawer.onClose();
          // Reset back to original
          setTabValue(TabIndex.Edit);
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
                        const updated: SavedMovement = await API.SavedMovements.update({
                          id: savedMovement.id,
                          name: newName,
                        });
                        // Update local state
                        if (!DataState.isReady(savedMovements)) throw Error('Unreachable');
                        const next = savedMovements.slice();
                        next[next.indexOf(savedMovement)] = updated;
                        setSavedMovements(next);
                        // Close drawer
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
                      await API.SavedMovements.delete(savedMovement.id);
                      // Update local state
                      setSavedMovements(
                        DataState.map(savedMovements, _ => _.filter(_ => _.id !== savedMovement.id))
                      );
                      // Close drawer
                      savedMovementDrawer.onClose();
                      toast.success(`Deleted ${savedMovement.name}`);
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
                .map(m => Movements.update({ id: m.id, position: m.position + 1 }));
            } else {
              // take items between and move them down
              updates = movements
                .slice(sourceIndex + 1, targetIndex + 1)
                .map(m => Movements.update({ id: m.id, position: m.position - 1 }));
            }
            // move source to desired destination
            updates.push(Movements.update({ id: sourceMv.id, position: targetMv.position }));
            try {
              await Promise.all(updates);
              await refetchMovements();
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
                      const updated: Movement = await Movements.update({
                        id: movement.id,
                        name: newName,
                      });
                      // Update local state
                      if (!DataState.isReady(movements)) throw Error('Unreachable');
                      const next = movements.slice();
                      next[next.indexOf(movement)] = updated;
                      setMovements(next);
                      // Close drawer
                      movementMenuDrawer.onClose();
                      toast.success(`Movement renamed to ${newName}`);
                    } catch (error) {
                      toast.error(error.message);
                    }
                  }}
                />
              </Box>
              <Box>
                <Button
                  color="error"
                  startIcon={<DeleteOutline />}
                  onClick={async () => {
                    if (!window.confirm('Are you sure?')) return;
                    try {
                      const movement = movementMenuDrawer.getData();
                      if (!movement) throw TypeError('Unreachable: rename movement');
                      await Movements.delete(movement.id);
                      // Update local state
                      setMovements(
                        DataState.map(movements, _ => _.filter(_ => _.id !== movement.id))
                      );
                      // Close drawer
                      movementMenuDrawer.onClose();
                    } catch (error) {
                      toast.error(error.message);
                    }
                  }}
                >
                  Remove Movement
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
                            const updated = await API.SavedMovements.update({
                              id: savedMovement.id,
                              note: nextNote,
                            });
                            // Update local state
                            const copy = [...savedMovements];
                            copy[copy.indexOf(savedMovement)] = updated;
                            setSavedMovements(copy);
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
          // textAlign: 'center',
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
            padding: `8px ${
              setIsCompleted && movementSet.repCountActual.toString().length > 1 ? '10px' : '13px'
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
  const [movementsHistory] = useDataState<Movement[]>(
    () =>
      API.Movements.getAll(
        where('savedMovementId', '==', savedMovement.id),
        orderBy('timestamp', 'desc')
      ),
    [savedMovement.id]
  );

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
      {heaviest && heaviestDate && (
        <Typography variant="caption">
          Heaviest was {heaviest}
          {movementsHistory[0].weightUnit} on {dateDisplay(heaviestDate)}.
        </Typography>
      )}
      <Stack
        spacing={1}
        sx={{
          maxHeight: '40vh',
          overflowY: 'scroll',
          '& > *:nth-child(even)': {
            backgroundColor: theme => theme.palette.action.hover,
          },
        }}
      >
        {movementsHistory.map((movement, index, { length }) => {
          const date = new Date(movement.timestamp);
          return (
            <Stack
              key={movement.id}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              width="100%"
              onClick={event => openLogDrawer(event, movement)}
              sx={{
                padding: theme => theme.spacing(1),
              }}
            >
              <Stack direction="row" display="flex" alignItems="center" spacing={2}>
                <Typography variant="overline" color="textSecondary">
                  {length - index}
                </Typography>
                <Typography color="body2">
                  {dateDisplay(date)}
                </Typography>
              </Stack>
              <Typography variant="overline">
                {Intl.NumberFormat().format(
                  MovementSet.summate(
                    movement.sets.filter(s => s.status === MovementSetStatus.Completed)
                  )
                )}{' '}
                {movement.sets?.[0]?.weight === 0 ? movement.repCountUnit : movement.weightUnit}
              </Typography>
              <Typography variant="body2">
                {formatDistanceToNowStrict(date, {
                  addSuffix: true,
                })
                  .replace(/ (\w)\w+ /i, '$1 ')
                  .replace('m ', 'mo ')}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
};

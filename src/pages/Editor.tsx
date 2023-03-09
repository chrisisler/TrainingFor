import { uuidv4 } from '@firebase/util';
import {
  Add,
  AddRounded,
  Close,
  CloseRounded,
  DeleteForeverRounded,
  DeleteOutline,
  EditOutlined,
  HelpRounded,
  MoreHoriz,
  Person,
  PlaylistAddRounded,
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
  Select,
  SelectProps,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { format } from 'date-fns';
import { getCountFromServer, limit, orderBy, query, where } from 'firebase/firestore';
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate, useParams } from 'react-router-dom';

import { API } from '../api';
import {WithVariable} from '../components/Variable';
import { useUser } from '../context';
import {
  Movement,
  MovementWeightUnit,
  MovementRepCountUnit,
  SavedMovement,
  MovementSetStatus,
  MovementSet,
} from '../types';
import {
  DataState,
  DataStateView,
  Paths,
  useDataState,
  useDrawer,
  useMaterialMenu,
  useResizableInputRef,
  useToast,
} from '../util';

/**
 * The main page of writing movements to training entries.
 *
 * There is no need for a TrainingLog template system when adding SavedMovements is easy and fast.
 * It should be obvious that a quick "program" can be created from the list of frequent (and recent) movements.
 */
export const Editor: FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const user = useUser();
  const { logId } = useParams<{ logId: string }>();
  const addMovementDrawer = useMaterialMenu();
  const sleepDrawer = useMaterialMenu();
  const addSetMenu = useDrawer<Movement>();
  const { anchorEl: _0, ...savedMovementDrawer } = useDrawer<SavedMovement>();
  const { anchorEl: _1, ...movementMenuDrawer } = useDrawer<Movement>();
  const { anchorEl: _2, ...logDrawer } = useDrawer<undefined>();

  /** Controlled state of the Add Movement input. */
  const [movementNameQuery, setMovementNameQuery] = useState('');
  /** Controlled state of the Add Set inputs. */
  const [newSetWeight, setNewSetWeight] = useState(0);
  const [newSetRepCount, setNewSetRepCount] = useState(0);

  /** List of movements for this log. */
  const [movements, setMovements] = useDataState<Movement[]>(async () => {
    if (logId) {
      return API.Movements.getAll(where('logId', '==', logId), orderBy('position', 'asc'));
    }
    return DataState.Empty;
  }, [logId]);

  /** List of saved movements from this users collection. */
  const [savedMovements, setSavedMovements] = useDataState<SavedMovement[]>(async () => {
    const savedMovements = await API.SavedMovements.getAll(user.uid);
    // Sort savedMovements by number of existing Movements with that savedMovementId.
    const countPromises = savedMovements.map(_ =>
      getCountFromServer(query(API.collections.movements, where('savedMovementId', '==', _.id)))
    );
    const snapshots = await Promise.all(countPromises);
    const usagesByMovement: number[] = snapshots.map(_ => _.data().count);
    // Attach `count` to each savedMovement, where count is the number of
    // existing Movements with that savedMovementId.
    // Then sort by frequency and recency.
    return savedMovements
      .map((sm, index) => Object.assign(sm, { count: usagesByMovement[index] }))
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

  const [log, setLog] = useDataState(async () => {
    if (!logId || !logDrawer.open) return DataState.Empty;
    const log = await API.TrainingLogs.get(logId);
    return log;
  }, [logId, logDrawer.open]);

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
        name: movementNameQuery,
        authorUserId: user.uid,
        id: '',
        lastSeen: timestamp,
      });
      const position = movements.length > 0 ? movements[movements.length - 1].position + 1 : 0;
      const newMovement: Movement = await API.Movements.create({
        logId,
        name: newSavedMovement.name,
        timestamp,
        sets: [],
        authorUserId: user.uid,
        savedMovementId: newSavedMovement.id,
        savedMovementName: newSavedMovement.name,
        position,
        isFavorited: false,
        id: '',
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
        const [previous] = await API.Movements.getAll(
          where('savedMovementId', '==', match.id),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const position = movements.length > 0 ? movements[movements.length - 1].position + 1 : 0;
        const now: number = Date.now();
        // Create a Movement from the match
        const newMovement: Movement = await API.Movements.create({
          logId,
          name: match.name,
          timestamp: now,
          // Get the sets for this new movement from prior history
          // prettier-ignore
          sets: previous.sets.length === 0 ? [] : previous.sets.map(s => ({
            ...s,
            status: MovementSetStatus.Unattempted,
            uuid: uuidv4(),
          })),
          authorUserId: user.uid,
          savedMovementId: match.id,
          savedMovementName: match.name,
          position,
          isFavorited: false,
          id: '',
          weightUnit: previous?.weightUnit ?? MovementWeightUnit.Pounds,
          repCountUnit: previous?.repCountUnit ?? MovementRepCountUnit.Reps,
        });
        // Update lastSeen property
        await API.SavedMovements.update({
          id: match.id,
          lastSeen: now,
        });
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
      addMovementDrawer,
      logId,
      movements,
      savedMovements,
      setMovements,
      setSavedMovements,
      toast,
      user.uid,
    ]
  );

  const addSetToMovement = useCallback(
    async (movement: Movement) => {
      if (!DataState.isReady(movements)) return;
      try {
        // Add new set to list of sets for this Movement
        const sets = movement.sets.concat({
          weight: newSetWeight,
          repCountActual: newSetRepCount,
          repCountExpected: newSetRepCount,
          status: MovementSetStatus.Unattempted,
          uuid: uuidv4(),
        });
        const updated: Movement = await API.Movements.update({
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
    [movements, newSetRepCount, newSetWeight, setMovements, toast]
  );

  // If no movements, display an info toast to add a movement to get started
  useEffect(() => {
    if (addMovementDrawer.open) return;
    if (!DataState.isReady(movements) || movements.length > 0) return;
    toast.info('Add a movement to get started!', {
      action: () => (
        <Button onClick={event => addMovementDrawer.onOpen(event)}>
          <AddRounded />
        </Button>
      ),
    });
  }, [addMovementDrawer, movements, toast]);

  // Random notice for sleep
  useEffect(() => {
    if (!(Math.random() >= 0.98)) return;
    toast.info('Make sure to get 8 hours of sleep!', {
      action: () => (
        <Button onClick={event => sleepDrawer.onOpen(event)}>
          <HelpRounded />
        </Button>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Box
        sx={{
          height: '100%',
          width: '100%',
          overflowY: 'scroll',
          padding: theme => theme.spacing(1, 2, 3, 2),
        }}
      >
        <Box display="flex" width="100%" justifyContent="center">
          <IconButton disableRipple size="small" onClick={event => logDrawer.onOpen(event, void 0)}>
            <ShortTextRounded />
          </IconButton>
        </Box>

        <Stack spacing={2}>
          <DataStateView data={movements}>
            {movements => (
              <>
                {movements.map((movement: Movement, movementIndex) => (
                  <Stack key={movement.id} sx={{ padding: theme => theme.spacing(1, 0) }}>
                    <Box
                      display="flex"
                      alignItems="end"
                      width="100%"
                      justifyContent="space-between"
                    >
                      {/** alignItems here could be END or BASELINE */}
                      <Stack
                        direction="row"
                        alignItems="end"
                        justifyContent="space-between"
                        width="100%"
                      >
                        <Box display="flex" alignItems="baseline">
                          <Typography
                            fontSize="1.0rem"
                            sx={{ padding: theme => theme.spacing(0.5, 0.5, 0.5, 0.5) }}
                            onClick={event => movementMenuDrawer.onOpen(event, movement)}
                            fontWeight={600}
                          >
                            {movement.name}
                          </Typography>

                          {/** Display volume or reps total. */}
                          {/** Avoids using unit to distinguish weightless/bodyweight as enum variants may change. */}
                          {movement.sets.filter(_ => _.status === MovementSetStatus.Completed)
                            .length >= 1 && (
                            <Typography
                              variant="overline"
                              sx={{
                                opacity: 0.7,
                                color: 'text.secondary',
                                marginLeft: theme => theme.spacing(1),
                              }}
                            >
                              {Intl.NumberFormat().format(
                                movement.sets[0].weight > 0
                                  ? movement.sets.reduce(
                                      (sum, _) =>
                                        _.status === MovementSetStatus.Completed
                                          ? sum + _.repCountActual * _.weight
                                          : sum,
                                      0
                                    )
                                  : movement.sets.reduce(
                                      (sum, _) =>
                                        _.status === MovementSetStatus.Completed
                                          ? sum + _.repCountActual
                                          : sum,
                                      0
                                    )
                              )}
                            </Typography>
                          )}
                        </Box>
                        <IconButton
                          disableRipple
                          sx={{ color: 'text.secondary' }}
                          onClick={event => {
                            addSetMenu.onOpen(event, movement);
                            // Set controlled state default values to previous set
                            if (movement.sets.length > 0) {
                              const lastSet = movement.sets[movement.sets.length - 1];
                              setNewSetWeight(lastSet.weight);
                              setNewSetRepCount(lastSet.repCountActual);
                            } else {
                              setNewSetWeight(0);
                              setNewSetRepCount(0);
                            }
                          }}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Box>
                    <Box width="100%" sx={{ overflowX: 'scroll' }}>
                      <Stack direction="row" spacing={1.6}>
                        {/** Stack of unit control text buttons */}
                        {movement.sets.length > 0 && (
                          <Stack
                            alignItems="end"
                            spacing={1}
                            marginRight={-0.5}
                            marginLeft="-4px"
                          >
                            <MovementUnitSelect
                              value={movement.weightUnit}
                              onChange={async event => {
                                try {
                                  const newWeightUnit = event.target.value as MovementWeightUnit;
                                  // Update field on the movement
                                  const updated: Movement = await API.Movements.update({
                                    id: movement.id,
                                    weightUnit: newWeightUnit,
                                  });
                                  // Update local state
                                  const copy = movements.slice();
                                  copy[movementIndex] = updated;
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
                                  const newRepCountUnit = event.target
                                    .value as MovementRepCountUnit;
                                  // Update field on the movement
                                  const updated: Movement = await API.Movements.update({
                                    id: movement.id,
                                    repCountUnit: newRepCountUnit,
                                  });
                                  // Update local state
                                  const copy = movements.slice();
                                  copy[movementIndex] = updated;
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
                                const updated = await API.Movements.update({
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
              </>
            )}
          </DataStateView>

          {DataState.isReady(movements) && (
            <Box display="flex" width="100%" justifyContent="center">
              <IconButton
                disableRipple
                sx={{ opacity: 0.5, color: 'text.secondary' }}
                size="large"
                onClick={addMovementDrawer.onOpen}
              >
                <PlaylistAddRounded sx={{ fontSize: '1.7rem' }} />
              </IconButton>
            </Box>
          )}
        </Stack>
      </Box>

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
                    if (newSetRepCount === 0) {
                      addSetMenu.onClose();
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
                <Stack spacing={3} width="75vw" sx={{ padding: theme => theme.spacing(1, 3) }}>
                  <Box width="100%" textAlign="center" marginBottom="-1rem">
                    <Typography variant="overline">
                      <Collapse in={newSetRepCount > 0}>
                        Click anywhere to add set
                      </Collapse>
                      <Collapse in={newSetRepCount === 0}>
                        Add Set #<b>{movement.sets.length + 1}</b>
                      </Collapse>
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={3}>
                    <TextField
                      variant="standard"
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                      value={newSetWeight}
                      onChange={event => setNewSetWeight(+event.target.value)}
                      onFocus={event => event.currentTarget.select()}
                      InputProps={{
                        startAdornment: (
                          <Typography variant="overline" mr={1} alignSelf="end">
                            {movement.weightUnit}
                          </Typography>
                        ),
                        sx: { fontSize: '1.3rem' },
                      }}
                    />
                    <TextField
                      variant="standard"
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                      value={newSetRepCount}
                      onChange={event => setNewSetRepCount(+event.target.value)}
                      onFocus={event => event.currentTarget.select()}
                      InputProps={{
                        startAdornment: (
                          <Typography variant="overline" mr={1} alignSelf="end">
                            {MovementRepCountUnit[movement.repCountUnit]}
                          </Typography>
                        ),
                        sx: { fontSize: '1.3rem' },
                      }}
                    />
                  </Stack>
                  <Button
                    size="large"
                    variant="contained"
                    sx={{ color: 'text.secondary', backgroundColor: 'divider' }}
                    onClick={addSetMenu.onClose}
                    startIcon={<CloseRounded fontSize="small" />}
                  >
                    Close
                  </Button>
                  {movement.sets.length > 0 && (
                    <Button
                      variant="text"
                      color="error"
                      startIcon={<DeleteOutline fontSize="small" />}
                      onClick={async function deleteSet() {
                        try {
                          const last = movement.sets[movement.sets.length - 1];
                          if (!last) throw TypeError('Unreachable: last');
                          const updated: Movement = await API.Movements.update({
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
                      Delete
                    </Button>
                  )}
                </Stack>
              </Menu>
            )
          }
        </WithVariable>
      </Backdrop>

      <SwipeableDrawer {...sleepDrawer} anchor="top">
        <Collapse in={sleepDrawer.open}>
          <Typography>Sleep is more important than training and eating.</Typography>
        </Collapse>
      </SwipeableDrawer>

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
              <Button variant="outlined" onClick={() => navigate(Paths.account)}>
                <Person />
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                variant="outlined"
                onClick={() => {
                  toast.info('Unimplemented: Update log notes.');
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
                {DataState.isReady(log) ? <>{format(new Date(log.timestamp), 'MMM M')}</> : <></>}
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
                color="error"
                variant="outlined"
                onClick={async () => {
                  if (!logId) throw Error('Unreachable');
                  if (!window.confirm('Delete Training?')) return;
                  try {
                    await API.TrainingLogs.delete(logId);
                    logDrawer.onClose();
                    navigate(Paths.account);
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

      <SwipeableDrawer {...addMovementDrawer} anchor="top">
        <Collapse in={addMovementDrawer.open}>
          {/** Top 3-8 recommendations */}

          <Stack spacing={1} key={JSON.stringify(addMovementDrawer)}>
            <Box>
              {/** FocusLock-ed things are in a Box to to prevent bug with Stack spacing. */}
              <ReactFocusLock disabled={!addMovementDrawer.open} returnFocus>
                <TextField
                  fullWidth
                  variant="standard"
                  // label="Search for a movement..."
                  helperText="Select a movement or create one"
                  value={movementNameQuery}
                  onChange={event => setMovementNameQuery(event.target.value)}
                  InputProps={{
                    endAdornment: !!movementNameQuery && (
                      <IconButton
                        disableRipple
                        size="small"
                        onClick={() => setMovementNameQuery('')}
                      >
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
                const hasFoundExactName = matches.some(_ => _.name === movementNameQuery);
                const hasFuzzyNameMatch = matches.some(_ => _.name.includes(movementNameQuery));
                return (
                  <>
                    {matches.length > 0 && (
                      <Collapse in={queryIsEmpty || (!queryIsEmpty && hasFuzzyNameMatch)}>
                        <Stack spacing={1}>
                          {matches.map((match: SavedMovement) => (
                            <Box key={match.id} display="flex" justifyContent="space-between">
                              <Typography
                                sx={{
                                  padding: theme => theme.spacing(0.5, 1),
                                  borderRadius: 1,
                                  border: '1px solid lightgrey',
                                }}
                                onClick={() => addMovementFromExistingSavedMovement(match)}
                              >
                                {match.name}
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
                          ))}
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

      {/** SavedMovement Update + Delete Drawer */}
      <SwipeableDrawer {...savedMovementDrawer.props()} anchor="top">
        <Collapse in={savedMovementDrawer.open}>
          <Stack spacing={1} key={JSON.stringify(savedMovementDrawer)}>
            <Box>
              <ReactFocusLock disabled={!savedMovementDrawer.open} returnFocus>
                <TextField
                  fullWidth
                  variant="standard"
                  label="Saved Movement Name"
                  helperText="Saved Movement will be renamed at the previous screen."
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
        </Collapse>
      </SwipeableDrawer>

      {/** Movement Menu Drawer */}
      <SwipeableDrawer {...movementMenuDrawer.props()} anchor="top">
        <Collapse in={movementMenuDrawer.open}>
          <Stack spacing={1} key={JSON.stringify(movementMenuDrawer)}>
            <Box>
              <ReactFocusLock disabled={!movementMenuDrawer.open} returnFocus>
                <TextField
                  fullWidth
                  variant="standard"
                  label="Movement Name"
                  helperText="Movement will be renamed at the previous screen."
                  defaultValue={movementMenuDrawer.getData()?.name}
                  onBlur={async function editMovement(event) {
                    try {
                      const movement = movementMenuDrawer.getData();
                      if (!movement) return;
                      const newName = event.target.value;
                      if (newName.length < 3 || newName === movement.name) {
                        return;
                      }
                      const updated: Movement = await API.Movements.update({
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
              </ReactFocusLock>
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
                    await API.Movements.delete(movement.id);
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
                Remove
              </Button>
            </Box>
          </Stack>
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

  const dynamicRepCountButtonStyle = useMemo(
    () =>
      movementSet.status === MovementSetStatus.Completed
        ? {
            backgroundColor: alpha(theme.palette.success.light, 0.06),
            // Avoid jarring when switching between Unattempted and Completed
            borderBottom: `2px solid ${theme.palette.success.light}`,
            color: theme.palette.success.light,
          }
        : {
            backgroundColor: alpha(theme.palette.divider, 0.03),
            borderBottom: `2px solid ${theme.palette.divider}`,
          },
    [movementSet.status, theme]
  );

  const decrementRepCount = useCallback(() => {
    const { repCountActual, repCountExpected, status } = movementSet;
    setConfetti(false);
    // First click: Unattempted status -> Completed status
    if (repCountActual === repCountExpected && status === MovementSetStatus.Unattempted) {
      movement.sets[index].status = MovementSetStatus.Completed;
      // Intermittent reinforcement is the delivery of a reward at irregular
      // intervals, a method that has been determined to yield the greatest
      // effort from the subject. The subject does not receive a reward each
      // time they perform a desired behavior but at seemingly random intervals.
      if (Math.random() > 0.66) {
        setConfetti(true);
      }
    } else if (repCountActual === 0) {
      // Last click: Completed status -> Unattempted status && reset reps achieved
      movement.sets[index].status = MovementSetStatus.Unattempted;
      movement.sets[index].repCountActual = repCountExpected;
    } else if (status === MovementSetStatus.Completed) {
      // Not first or last click: Decrement number of successful reps
      movement.sets[index].repCountActual -= 1;
    }
    updateSets([...movement.sets]);
  }, [index, movement.sets, movementSet, updateSets]);

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
          movement.sets[index].weight = value;
          updateSets([...movement.sets]);
        }}
        style={{
          height: '100%',
          color:
            weight === 0 || movementSet.status === MovementSetStatus.Unattempted
              ? theme.palette.text.secondary
              : theme.palette.text.primary,
          backgroundColor: 'transparent',
          width: '3ch',
          border: 'none',
          outline: 'none',
          margin: '0 auto',
          // textAlign: 'center',
          padding: '2px 4px',
          fontFamily: 'monospace',
          fontWeight: 500,
          fontSize: '1.1rem',
          letterSpacing: '0.004em',
        }}
      />

      <IconButton
        sx={{
          paddingY: theme => theme.spacing(1),
          paddingX: theme =>
            theme.spacing(movementSet.repCountActual.toString().length > 1 ? 1.33 : 2),
          borderRadius: 1,
        }}
        // Handles dynamic styling based on repCount button for a movement set
        style={dynamicRepCountButtonStyle}
        onClick={decrementRepCount}
      >
        {movementSet.repCountActual}
      </IconButton>
      {confetti && <ConfettiExplosion particleCount={45} width={400} force={0.4} />}
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
        padding: '8px',
      },
    }}
    sx={{
      color: theme => theme.palette.text.secondary,
      width: '100%',
      textAlign: 'right',
      textTransform: 'uppercase',
      border: 'none',
      fontSize: '0.7rem',
    }}
    IconComponent={() => null}
    value={value}
    onChange={onChange}
  >
    {children}
  </Select>
);

import { uuidv4 } from '@firebase/util';
import { Add, Close, DeleteOutline, MoreHoriz, PersonOutline, Remove } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  MenuItem,
  Select,
  SelectProps,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { orderBy, where } from 'firebase/firestore';
import { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { API } from '../api';
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
  const addSetDrawer = useMaterialMenu();
  const savedMovementDrawer = useDrawer<SavedMovement>();
  const movementMenuDrawer = useDrawer<Movement>();
  const addMovementBtnRef = useRef<HTMLButtonElement | null>(null);

  const [addSetDrawerMovement, setAddSetDrawerMovement] = useState<Movement | null>(null);
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
  const [savedMovements, setSavedMovements] = useDataState<SavedMovement[]>(
    async () => API.SavedMovements.getAll(user.uid),
    [user.uid]
  );

  // If no movements, auto-open the add movement drawer
  useEffect(() => {
    if (!DataState.isReady(movements)) {
      return;
    }
    if (movements.length === 0) {
      addMovementBtnRef.current?.click();
    }
  }, [movements]);

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

  const createSavedMovement = useCallback(async () => {
    if (!logId) {
      throw TypeError('Unreachable: logId is required');
    }
    if (!DataState.isReady(movements)) {
      return;
    }
    try {
      const newSavedMovement: SavedMovement = await API.SavedMovements.create({
        name: movementNameQuery,
        authorUserId: user.uid,
        id: '',
      });
      const position = movements.length > 0 ? movements[movements.length - 1].position + 1 : 0;
      const newMovement: Movement = await API.Movements.create({
        logId,
        name: newSavedMovement.name,
        timestamp: Date.now(),
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

  const addSetToMovement = useCallback(
    async event => {
      event.preventDefault();
      if (!DataState.isReady(movements)) throw Error('Unreachable');
      const movement = addSetDrawerMovement;
      if (!movement) throw Error('Unreachable');
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
        // Close drawer
        addSetDrawer.onClose();
        setAddSetDrawerMovement(null);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [
      addSetDrawer,
      addSetDrawerMovement,
      movements,
      newSetRepCount,
      newSetWeight,
      setMovements,
      toast,
    ]
  );

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        overflowY: 'scroll',
        padding: theme => theme.spacing(2),
      }}
    >
      <Box display="flex" width="100%" justifyContent="space-between">
        <Typography variant="overline">Training Page</Typography>
        <IconButton size="small" onClick={() => navigate(Paths.account)}>
          <PersonOutline fontSize="small" />
        </IconButton>
      </Box>

      <SwipeableDrawer {...addMovementDrawer} anchor="top">
        <Collapse in={addMovementDrawer.open}>
          {/** Top 3-8 recommendations */}

          <Stack spacing={3}>
            <TextField
              fullWidth
              variant="standard"
              label="Search for a movement..."
              helperText="Select a movement or create one"
              autoFocus={addMovementDrawer.open} // TODO I wish this would work! -> Try using ref= and .focus() it.
              value={movementNameQuery}
              onChange={event => setMovementNameQuery(event.target.value)}
              InputProps={{
                endAdornment: !!movementNameQuery && (
                  <IconButton disableRipple size="small" onClick={() => setMovementNameQuery('')}>
                    <Close />
                  </IconButton>
                ),
              }}
            />

            <DataStateView data={matches}>
              {matches => {
                const queryIsEmpty = movementNameQuery === '';
                const hasFoundExactName = matches.some(_ => _.name === movementNameQuery);
                const hasFuzzyNameMatch = matches.some(_ => _.name.includes(movementNameQuery));
                return (
                  <>
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
                              onClick={async () => {
                                if (!logId) {
                                  throw Error('Unreachable: logId is required');
                                }
                                if (!DataState.isReady(movements)) {
                                  return;
                                }
                                try {
                                  const position =
                                    movements.length > 0
                                      ? movements[movements.length - 1].position + 1
                                      : 0;
                                  // Create a Movement from the match
                                  const newMovement: Movement = await API.Movements.create({
                                    logId,
                                    name: match.name,
                                    timestamp: Date.now(),
                                    sets: [],
                                    authorUserId: user.uid,
                                    savedMovementId: match.id,
                                    savedMovementName: match.name,
                                    position,
                                    isFavorited: false,
                                    id: '',
                                    weightUnit: MovementWeightUnit.Pounds,
                                    repCountUnit: MovementRepCountUnit.Reps,
                                  });
                                  // Add the new Movement to the log
                                  setMovements(
                                    DataState.map(movements, prev => prev.concat(newMovement))
                                  );
                                  // Close the drawer
                                  addMovementDrawer.onClose();
                                  // Clear the input
                                  setMovementNameQuery('');
                                } catch (error) {
                                  toast.error(error.message);
                                }
                              }}
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
                          sx={{ justifyContent: 'flex-start' }}
                          variant="outlined"
                          startIcon={<Add />}
                          onClick={createSavedMovement}
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
            <TextField
              fullWidth
              autoFocus={savedMovementDrawer.open} // TODO wtf
              variant="standard"
              label="Movement Name"
              helperText="Movement will be renamed at the previous screen."
              // helperText="Enter a new name then click anywhere outside to update."
              defaultValue={savedMovementDrawer.getData()?.name}
              // Avoiding controlled state this way with onBlur
              onBlur={async event => {
                try {
                  const savedMovement = savedMovementDrawer.getData();
                  if (!savedMovement) throw Error('Unreachable');
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
                  toast.success(`Movement renamed to ${newName}`);
                } catch (error) {
                  toast.error(error.message);
                }
              }}
            />
            <Box>
              <Button
                color="error"
                startIcon={<DeleteOutline />}
                onClick={async () => {
                  try {
                    if (!window.confirm('Are you sure you want to delete this?')) return;
                    const savedMovement = savedMovementDrawer.getData();
                    if (!savedMovement) throw Error('Unreachable');
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

      <Stack spacing={1}>
        <DataStateView data={movements}>
          {movements => (
            <>
              {movements.map((movement: Movement, movementIndex) => (
                <Stack
                  spacing={1}
                  key={movement.id}
                  sx={{
                    // borderBottom: theme => `1px solid ${theme.palette.divider}`,
                    // borderRadius: 1,
                    padding: theme => theme.spacing(1, 0),
                  }}
                >
                  <Typography
                    fontSize="1.1rem"
                    sx={{ padding: theme => theme.spacing(0.5, 0.5, 0.5, 0.5) }}
                    onClick={event => {
                      movementMenuDrawer.onOpen(event, movement);
                    }}
                  >
                    {movement.name}
                  </Typography>
                  <Box width="100%" sx={{ overflowX: 'scroll' }}>
                    <Stack direction="row" spacing={1}>
                      {/** Stack of unit control text buttons */}
                      <Stack
                        alignItems="end"
                        visibility={movement.sets.length > 0 ? 'visible' : 'hidden'}
                        spacing={2}
                        sx={{ marginTop: '4px' }}
                      >
                        <MovementUnitSelect
                          value={movement.repCountUnit}
                          onChange={async event => {
                            try {
                              const newRepCountUnit = event.target.value as MovementRepCountUnit;
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
                          <MenuItem value={MovementWeightUnit.Weightless}>
                            {MovementWeightUnit.Weightless}
                          </MenuItem>
                        </MovementUnitSelect>
                      </Stack>

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

                      <Stack spacing={1}>
                        <IconButton
                          color="primary"
                          onClick={event => {
                            addSetDrawer.onOpen(event);
                            setAddSetDrawerMovement(movement);
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
                          <Add />
                        </IconButton>
                        {movement.sets.length > 0 ? (
                          <IconButton
                            sx={{ opacity: 0.4 }}
                            color="error"
                            onClick={async () => {
                              try {
                                const last = movement.sets[movement.sets.length - 1];
                                if (!last) throw TypeError('Unreachable');
                                const without = movement.sets.filter(_ => _.uuid !== last.uuid);
                                //
                                const updated: Movement = await API.Movements.update({
                                  sets: without,
                                  id: movement.id,
                                });
                                // Update local state
                                const copy = movements.slice();
                                copy[copy.indexOf(movement)] = updated;
                                setMovements(copy);
                              } catch (error) {
                                toast.error(error.message);
                              }
                            }}
                          >
                            <Remove fontSize="small" />
                          </IconButton>
                        ) : (
                          <Box>{/** Empty box for spacing/alignment */}</Box>
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              ))}
            </>
          )}
        </DataStateView>

        {/** Movement Menu Drawer */}
        <SwipeableDrawer {...movementMenuDrawer.props()} anchor="top">
          <Collapse in={movementMenuDrawer.open}>
            <Stack spacing={3}>
              <Button
                color="error"
                startIcon={<DeleteOutline />}
                onClick={async () => {
                  try {
                    const movement = movementMenuDrawer.getData();
                    if (!movement) throw TypeError('Unreachable');
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

                  // TODO remaining actions
                  // Move up
                  // Move down
                  // Edit name
                }}
              >
                Remove Movement
              </Button>
            </Stack>
          </Collapse>
        </SwipeableDrawer>

        {/** Add Set Drawer */}
        <SwipeableDrawer anchor="top" {...addSetDrawer}>
          <Collapse in={addSetDrawer.open}>
            {addSetDrawerMovement && (
              <Stack spacing={3} component="form" onSubmit={addSetToMovement}>
                <Box width="100%" textAlign="center">
                  <Typography variant="overline">{addSetDrawerMovement.name}</Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                  {addSetDrawerMovement.weightUnit !== MovementWeightUnit.Weightless && (
                    <>
                      <TextField
                        label={`Weight (${addSetDrawerMovement.weightUnit}s)`}
                        autoFocus={addSetDrawer.open || !!addSetDrawerMovement}
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        value={newSetWeight}
                        onChange={event => setNewSetWeight(+event.target.value)}
                      />
                      <Typography
                        variant="overline"
                        sx={{ color: theme => theme.palette.divider }}
                        display="flex"
                        alignItems="center"
                      >
                        <Close fontSize="small" />
                      </Typography>
                    </>
                  )}
                  <TextField
                    label={MovementRepCountUnit[addSetDrawerMovement.repCountUnit]}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    value={newSetRepCount}
                    onChange={event => setNewSetRepCount(+event.target.value)}
                  />
                </Stack>
                <Button
                  fullWidth
                  startIcon={<Add />}
                  type="submit"
                  variant="outlined"
                  size="large"
                  disabled={newSetRepCount === 0}
                >
                  Add Set {addSetDrawerMovement.sets.length + 1}
                </Button>
              </Stack>
            )}
          </Collapse>
        </SwipeableDrawer>

        <DataStateView data={movements}>
          {() => (
            <Button
              fullWidth
              ref={addMovementBtnRef}
              size="large"
              startIcon={<Add />}
              onClick={event => addMovementDrawer.onOpen(event)}
            >
              Movement
            </Button>
          )}
        </DataStateView>
      </Stack>
    </Box>
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

  const statusBasedStyle = useMemo(
    () =>
      movementSet.status === MovementSetStatus.Completed
        ? {
            backgroundColor: theme.palette.success.main,
            // Avoid jarring when switching between Unattempted and Completed
            border: '1px solid transparent',
          }
        : {
            border: `1px solid ${theme.palette.divider}`,
          },
    [movementSet.status, theme]
  );

  return (
    <Stack>
      <IconButton
        sx={{
          padding: theme => theme.spacing(1, 2),
        }}
        // Handles dynamic styling based on repCount button for a movement set
        style={statusBasedStyle}
        onClick={() => {
          const { repCountActual, repCountExpected, status } = movementSet;
          // First click: Unattempted status -> Completed status
          if (repCountActual === repCountExpected && status === MovementSetStatus.Unattempted) {
            movement.sets[index].status = MovementSetStatus.Completed;
          } else if (repCountActual === 0) {
            // Last click: Completed status -> Unattempted status && reset reps achieved
            movement.sets[index].status = MovementSetStatus.Unattempted;
            movement.sets[index].repCountActual = repCountExpected;
          } else if (status === MovementSetStatus.Completed) {
            // Not first or last click: Decrement number of successful reps
            movement.sets[index].repCountActual -= 1;
          }
          updateSets([...movement.sets]);
          // Side Note: Deleting a set is done through clicking the movement name button.
        }}
      >
        {movementSet.repCountActual}
      </IconButton>

      {movement.weightUnit !== MovementWeightUnit.Weightless && (
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
              throw Error('Unreachable');
            }
            const value = +event.target.value;
            movement.sets[index].weight = value;
            updateSets([...movement.sets]);
          }}
          style={{
            height: '100%',
            color: theme.palette.text.primary,
            backgroundColor: 'transparent',
            width: '3ch',
            border: 'none',
            outline: 'none',
            // lineHeight: '1 !important',
            margin: '0 auto',
            // textAlign: 'center',
            padding: '2px 4px',
            fontFamily: 'monospace',
            fontWeight: 500,
            fontSize: '1.1rem',
            letterSpacing: '0.004em',
          }}
        />
      )}
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

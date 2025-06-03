import { uuidv4 } from '@firebase/util';
import { useIsMutating } from '@tanstack/react-query';
import {
  Add,
  Close,
  History,
  Link,
  MoreHoriz,
  NavigateNextRounded,
  ChatOutlined,
  Notes,
  NoteAltOutlined,
  DeleteForeverOutlined,
  CopyAll,
  PlaylistRemove,
  DriveFileRenameOutline,
  RemoveCircleOutline,
  Title,
  RefreshRounded,
  KeyboardArrowDownRounded,
  ChevronRightRounded,
  CheckRounded,
  PlusOneRounded,
  BackspaceOutlined,
  EditOutlined,
} from '@mui/icons-material';
import {
  alpha,
  Backdrop,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Collapse,
  darken,
  Divider,
  Fab,
  Fade,
  IconButton,
  lighten,
  Menu,
  MenuItem,
  Paper,
  Select,
  SelectProps,
  Skeleton,
  Stack,
  SwipeableDrawer,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { limit, orderBy, where } from 'firebase/firestore';
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
// import ConfettiExplosion from 'react-confetti-explosion';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate, useParams } from 'react-router-dom';

import { API, useStore } from '../api';
import {
  AccountPanel,
  NotesDrawer,
  ShareBtn,
  tabA11yProps,
  TabPanel,
  Timer,
  WithVariable,
} from '../components';
import {
  Movement,
  MovementWeightUnit,
  MovementRepCountUnit,
  SavedMovement,
  MovementSetStatus,
  MovementSet,
  TrainingLog,
  abbreviate,
} from '../types';
import {
  DataState,
  DataStateView,
  dateDisplay,
  ord,
  ordinalSuffix,
  Paths,
  useDrawer,
  useMaterialMenu,
  usePrevious,
  useResizableInputRef,
  useToast,
  useUser,
} from '../util';

const DIFF_CHAR = '-';

const DEFAULT_MIN_REPS = 5;
const DEFAULT_MAX_REPS = 30;

const headerSpacing = '168px';

/**
 * Wrapper page for editing training entries.
 */
export const Editor: FC = () => {
  const { logId } = useParams<{ logId: string }>();
  const programDrawer = useDrawer<string>();
  const programLogTemplateId = programDrawer.getData();

  return (
    <>
      <Box
        sx={{
          height: '100%',
          width: '100vw',
          overflowY: 'scroll',
          padding: theme => theme.spacing(0.5, 0, 3, 0),
        }}
      >
        {!!logId && <EditorInternals logId={logId} />}
      </Box>

      <SwipeableDrawer {...programDrawer.props()} anchor="bottom">
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
          {programLogTemplateId && (
            <EditorInternals readOnly isProgramView logId={programLogTemplateId} />
          )}
        </Box>
      </SwipeableDrawer>
    </>
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
  const notesDrawer = useDrawer<TrainingLog>();

  const prefersDark = useMediaQuery('@media (prefers-color-scheme: dark)');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const toast = useToast();
  const user = useUser();
  const navigate = useNavigate();
  const isMutating = useIsMutating() > 0;
  const isMutatingPlus = usePrevious(isMutating) && isMutating;

  // Data is null when *adding*; when *replacing*, it's the replacing Movement.
  const { anchorEl: _3, ...addMovementDrawer } = useDrawer<null | Movement>();
  const addSetMenu = useDrawer<Movement>();
  const { anchorEl: _0, ...savedMovementDrawer } = useDrawer<null | Pick<
    SavedMovement,
    'id' | 'name'
  >>();
  const { anchorEl: _2, ...historyLogDrawer } = useDrawer<Movement>();
  // TODO undefined useDrawer convert to useMaterialMenu
  const { anchorEl: _4, ...logDrawer } = useDrawer<undefined>();
  const accountDrawer = useMaterialMenu();

  const [pinned, setPinned] = useState(false);
  /** Controlled state of the Add Movement input. */
  const [movementNameQuery, setMovementNameQuery] = useState('');
  /** Controlled state of the Add Set inputs. */
  const [newSetWeight, setNewSetWeight] = useState(0);
  const [newSetRepCountMin, setNewSetRepCountMin] = useState(DEFAULT_MIN_REPS);
  const [newSetRepCountMax, setNewSetRepCountMax] = useState(DEFAULT_MAX_REPS);
  /** State for re-ordering the list of movements. Holds the Movement to swap places with. */
  const [movementOrderSwap, setMovementOrderSwap] = useState<null | Movement>(null);
  /** For SavedMovement edit/update menu. */
  const [tabValue, setTabValue] = useState(TabIndex.History);

  const TrainingLogsAPI = useStore(store => store.TrainingLogsAPI);
  const MovementsMutationAPI = useStore(store =>
    isProgramView ? store.ProgramMovementsAPI : store.MovementsAPI
  );
  const SavedMovementsAPI = useStore(store => store.SavedMovementsAPI);
  const MovementsAPI = useStore(store => store.MovementsAPI);

  const savedMovements = useStore(store => store.savedMovements);
  const movements = useStore(store => store.useMovements(logId, isProgramView));
  const logs = useStore(store => store.logs);
  const log = DataState.map(
    logs,
    _ => _.find(log => log.id === logId) ?? DataState.error('Log not found')
  );

  /** The active collection, based on the usage of this component. */
  const MovementsQueryAPI = useMemo(
    () => (isProgramView ? API.ProgramMovements : API.Movements),
    [isProgramView]
  );

  // Handle debounced search for SavedMovements
  const [matches, setMatches] = useState<DataState<SavedMovement[]>>(DataState.Empty);
  useEffect(() => {
    if (!DataState.isReady(savedMovements)) {
      return;
    }

    if (movementNameQuery === '' || movementNameQuery.length < 2) {
      // No search input, so show all SavedMovements
      setMatches(savedMovements);
      return;
    }

    // `movementNameQuery` already validated and matches is valid, so show search activity
    if (DataState.isReady(matches)) {
      setMatches(DataState.Loading);
    }

    const t = setTimeout(async () => {
      const query = movementNameQuery.toLowerCase();
      setMatches(savedMovements.filter(_ => _.name.toLowerCase().includes(query)));
    }, 500);

    return () => clearTimeout(t);
    // Purposefully excluding `matches` to avoid infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // TODO global activity indicator here
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

  useEffect(() => {
    if (isProgramView || !DataState.isError(log) || !DataState.isReady(logs)) {
      return;
    }

    navigate(Paths.editor(logs[0].id, TrainingLog.title(logs[0])));
  }, [log, logs, navigate, isProgramView]);

  useEffect(() => {
    if (isMobile === false) return;
    if (pinned) {
      setPinned(false);
    }
  }, [isMobile, pinned]);

  return (
    <main
      style={{
        width: '100%',
        margin: '0 auto',
        maxWidth: '708px',
      }}
    >
      {readOnly === false && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            // fixed header
            position: 'absolute',
            top: 0,
            width: '100vw',
            zIndex: 100,
            left: 0,
            padding: theme => theme.spacing(0, 0.5),
            backgroundColor: theme => theme.palette.background.default,
          }}
        >
          {isProgramView === false && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              onMouseOver={event => {
                accountDrawer.onOpen(event);
              }}
              onClick={event => {
                accountDrawer.onOpen(event);
              }}
            >
              <IconButton
                sx={{
                  color: theme => theme.palette.text.secondary,
                }}
              >
                <Notes />
              </IconButton>
              <Typography variant="body2">{TrainingLog.title(log)}</Typography>
            </Stack>
          )}

          <Stack direction="row">
            {isProgramView === false && (
              <>
                <ShareBtn />

                <IconButton
                  onClick={() => {
                    console.warn('Unimplemented: chat/comments panel: 385px desktop, 100vw mobile');
                  }}
                >
                  <ChatOutlined
                    fontSize={isMobile ? 'medium' : 'small'}
                    sx={{ color: 'text.secondary' }}
                  />
                </IconButton>

                <Timer />

                <IconButton
                  onClick={event => {
                    console.warn('unimplemented: see roadmap for this feature');

                    return logDrawer.onOpen(event, void 0);
                  }}
                >
                  <MoreHoriz sx={{ color: 'text.secondary' }} />
                </IconButton>
              </>
            )}
          </Stack>
        </Stack>
      )}

      <DataStateView
        data={movements}
        loading={() => (
          <Fade in>
            <Stack
              sx={{
                paddingTop: readOnly || isMobile || isProgramView ? '3rem' : '5rem',
                transform: !isMobile && pinned ? `translateX(${headerSpacing})` : 'none',
              }}
              spacing={5}
            >
              <Skeleton width="100%" height="40px" sx={{ borderRadius: 5 }} />
            </Stack>
          </Fade>
        )}
      >
        {movements => {
          return (
            <Stack
              spacing={4}
              // Block all mouse clicks/events when in readOnly mode
              sx={readOnly ? { '& *': { pointerEvents: 'none' } } : void 0}
              style={{
                // Padding top specifically to account for fixed header
                padding: '1rem',
                paddingBottom: 0,
                paddingTop: readOnly || isMobile || isProgramView ? '3rem' : '5rem',

                // spacing for pinned header
                transform: !isMobile && pinned ? `translateX(${headerSpacing})` : 'none',
              }}
            >
              {movements.map(movement => (
                <Fade in key={movement.id}>
                  <Stack
                    spacing={0.5}
                    sx={{ cursor: 'pointer' }}
                    onClick={event => {
                      if (readOnly) {
                        return;
                      }

                      addSetMenu.onOpen(event, movement);

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
                    <Box
                      display="flex"
                      alignItems="end"
                      width="100%"
                      justifyContent="space-between"
                    >
                      <Stack display="flex" alignItems="baseline" direction="row" spacing={0.5}>
                        <Stack direction="row" alignItems="center">
                          <Typography
                            sx={{
                              fontSize: '1.1rem',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                              letterSpacing: 0,
                              color: theme => theme.palette.text.primary,
                            }}
                          >
                            {movement.name}
                          </Typography>

                          <KeyboardArrowDownRounded
                            fontSize="small"
                            sx={{
                              color:
                                movement.sets.length === 0
                                  ? theme.palette.primary.main
                                  : theme.palette.text.secondary,
                              // color: theme.palette.primary.main,
                            }}
                          />
                        </Stack>

                        {/** Display volume or reps total. */}
                        {/** Avoids using unit to distinguish weightless/bodyweight as enum variants may change. */}
                        <WithVariable
                          value={movement.sets.filter(
                            _ => _.status === MovementSetStatus.Completed
                          )}
                        >
                          {completedSets => {
                            if (completedSets.length === 0) {
                              return null;
                            }

                            const completedVol = MovementSet.summate(completedSets);
                            const totalVol = MovementSet.summate(movement.sets);

                            return (
                              <Typography
                                variant="overline"
                                sx={{
                                  color: 'text.secondary',
                                  lineHeight: 1,
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
                      </Stack>
                    </Box>

                    {DataState.isReady(savedMovements) && (
                      <WithVariable
                        value={savedMovements.find(_ => _.id === movement.savedMovementId)}
                      >
                        {savedMovement =>
                          !savedMovement?.note?.length ? null : (
                            <Typography
                              variant="subtitle2"
                              sx={{
                                padding: theme => theme.spacing(0.5, 1, 0.5, 2.0),
                                // fontStyle: 'italic',
                                fontWeight: 300,
                                borderLeft: theme => `2px solid ${theme.palette.divider}`,
                                color: theme => theme.palette.text.secondary,
                              }}
                            >
                              {savedMovement.note}
                            </Typography>
                          )
                        }
                      </WithVariable>
                    )}

                    <Box width="100%" sx={{ overflowX: 'scroll', display: 'flex' }}>
                      {movement.sets.length > 0 && (
                        <Stack alignItems="end" spacing={1.75}>
                          <Typography
                            variant="overline"
                            alignSelf="end"
                            textTransform="capitalize"
                            sx={{ color: 'text.secondary', letterSpacing: 0.5 }}
                          >
                            {movement.weightUnit}
                          </Typography>

                          <Typography
                            variant="overline"
                            alignSelf="end"
                            textTransform="capitalize"
                            sx={{ color: 'text.secondary', letterSpacing: 0.5 }}
                          >
                            {abbreviate(movement.repCountUnit)}
                          </Typography>
                        </Stack>
                      )}

                      <Stack direction="row" spacing={2}>
                        {/** Stack of unit control text display */}
                        {movement.sets.map((movementSet, index) => (
                          <MovementSetView
                            isProgramView={isProgramView}
                            key={movementSet.uuid}
                            movementSet={movementSet}
                            movement={movement}
                            index={index}
                          />
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                </Fade>
              ))}

              <Box width="100%" padding={2} />

              <Button
                onClick={event => addMovementDrawer.onOpen(event, null)}
                disabled={readOnly}
                disableTouchRipple
                sx={{
                  position: 'fixed',
                  right: '32px',
                  bottom: '32px',
                  backgroundColor: theme => alpha(lighten(theme.palette.background.paper, 0.0), 1.0),
                  px: 2,
                  // backdropFilter: 'blur(4px)',
                  border: theme => `1px solid ${theme.palette.divider}`,
                }}
                size="large"
                startIcon={<EditOutlined />}
              >
                Exercises
              </Button>
            </Stack>
          );
        }}
      </DataStateView>

      {/** ------------------------- DRAWERS ------------------------- */}

      <Backdrop open={addSetMenu.open} sx={{ color: '#fff' }}>
        <WithVariable value={addSetMenu.getData()}>
          {movement =>
            movement === null ? null : (
              <Menu
                open={addSetMenu.open}
                anchorEl={addSetMenu.anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                onClose={async (_event, reason) => {
                  if (!DataState.isReady(movements)) {
                    throw Error('Unreachable: movements not ready');
                  }

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
                        .map(m =>
                          MovementsMutationAPI.update({ id: m.id, position: m.position + 1 })
                        );
                    } else {
                      // take items between and move them down
                      updates = movements
                        .slice(sourceIndex + 1, targetIndex + 1)
                        .map(m =>
                          MovementsMutationAPI.update({ id: m.id, position: m.position - 1 })
                        );
                    }
                    // move source to desired destination
                    updates.push(
                      MovementsMutationAPI.update({ id: sourceMv.id, position: targetMv.position })
                    );
                    try {
                      await Promise.all(updates);

                      setMovementOrderSwap(null);
                    } catch (error) {
                      toast.error(error.message);
                    }
                  }

                  if (reason === 'backdropClick') {
                    if (newSetRepCountMin === 0) {
                      addSetMenu.onClose();
                      return;
                    }
                    if (newSetRepCountMax < newSetRepCountMin) {
                      toast.error('Maximum must be less than minimum');
                      return;
                    }
                    addSetMenu.onClose();
                    return;
                  }

                  // Click was NOT on the backdrop so it was within
                  // the menu which means the user is clicking
                  // around in the menu, so do nothing.
                  return;
                }}
                PaperProps={{
                  sx: {
                    maxWidth: isMobile ? '95vw' : '700px',
                    overflowX: 'scroll',
                    paddingX: '0.25rem',
                    justifyItems: 'center',
                    display: 'flex',
                  },
                }}
                MenuListProps={{
                  sx: { padding: 0.5, },
                }}
              >
                <Stack gap={1.5}>
                  <Stack gap={0.5} direction="row" alignItems="anchor-center">
                    <Fab
                      onClick={async () => {
                        const sets = movement.sets.concat({
                          weight: newSetWeight,
                          repCountActual: newSetRepCountMax,
                          repCountExpected: newSetRepCountMin,
                          repCountMaxExpected: newSetRepCountMax,
                          status: MovementSetStatus.Unattempted,
                          uuid: uuidv4(),
                        });

                        try {
                          const updatedMovement = await MovementsMutationAPI.update({
                            sets,
                            id: movement.id,
                          });
                          if (!updatedMovement) {
                            throw Error('Failed to add set to movement');
                          }
                          // Update Add Set panel so future operations include the new set
                          addSetMenu.setData(updatedMovement);
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                      disabled={isMutating}
                      sx={{
                        // color: theme => theme.palette.text.primary,
                        // backgroundColor: theme => alpha(theme.palette.primary.main, 0.2),
                      }}
                      color="primary"
                      aria-label="add"
                    >
                      {isMutating ? <CircularProgress size={24} /> : <PlusOneRounded />}
                    </Fab>

                    <Box display="flex">
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
                      <TextField
                        variant="standard"
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        value={newSetWeight}
                        onChange={event => {
                          setNewSetWeight(+event.target.value);
                        }}
                        onFocus={event => event.currentTarget.select()}
                        InputProps={{
                          sx: {
                            fontSize: '1.5rem',
                            width: '60px',
                            marginTop: '0.70rem',
                          },
                        }}
                        // idk
                        InputLabelProps={{
                          sx: {
                            marginTop: '0.70rem',
                          },
                        }}
                      />
                    </Box>

                    <Box display="flex">
                      <MovementUnitSelect
                        value={movement.repCountUnit}
                        onChange={async event => {
                          try {
                            const updated: Movement = await MovementsMutationAPI.update({
                              id: movement.id,
                              repCountUnit: event.target.value as MovementRepCountUnit,
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
                        <MenuItem value={MovementRepCountUnit.RepsInReserve}>
                          {MovementRepCountUnit.RepsInReserve}
                        </MenuItem>
                      </MovementUnitSelect>

                      <TextField
                        variant="standard"
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        value={newSetRepCountMin}
                        label="Minimum"
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
                        label="Maximum"
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

                    {/** Re-order / position buttons (1st, 2nd, 3rd, 4th)*/}
                    <DataStateView data={movements} loading={() => null}>
                      {movements => {
                        if (movements.length <= 1) return null;

                        const selectedMovement = movement;
                        return (

                          <>
                            <Divider orientation="vertical" flexItem sx={{ m: 1 }} />
                            <Stack ml={0}>
                              <Typography variant="caption" color="textSecondary" textAlign="end">
                                Movement Order
                              </Typography>
                              <Stack spacing={0.5} direction="row" alignItems="center" maxWidth="200px" overflow="scroll">
                                {movements.map((movement, movementIndex) => {
                                  const isSelected = movement.position === movementOrderSwap?.position;
                                  return (
                                    <Button
                                      id={movement.id}
                                      key={movement.id}
                                      disableTouchRipple
                                      variant={isSelected ? 'contained' : 'text'}
                                      disabled={selectedMovement.id === movement.id}
                                      onClick={() => {
                                        // un/select
                                        setMovementOrderSwap(isSelected ? null : movement);
                                      }}
                                      // https://uxmovement.com/mobile/optimal-size-and-spacing-for-mobile-buttons/
                                      sx={{
                                        minWidth: '35px',
                                        backgroundColor: theme =>
                                          isSelected ? 'none' : theme.palette.action.hover,
                                        padding: theme => theme.spacing(0.5, 0.75),
                                        textDecoration: selectedMovement.id === movement.id ? 'underline' : 'none',
                                        // color: theme => theme.palette.text.primary,
                                      }}
                                    // size="large"
                                    >
                                      <b>{movementIndex + 1}</b>{ord(movementIndex + 1)}
                                    </Button>
                                  );
                                })}
                              </Stack>
                            </Stack>
                          </>
                        );
                      }}
                    </DataStateView>

                  </Stack>

                  <Stack gap={1} direction="row" alignItems="anchor-center">
                    {movement.sets.length > 0 && (
                      <>
                        <Button
                          disabled={isMutating}
                          sx={{ color: theme => theme.palette.text.primary }}
                          onClick={async function deleteLastSet() {
                            let sets = movement.sets.slice();
                            // Remove last element
                            sets.pop();

                            try {
                              const updated = await MovementsMutationAPI.update({
                                id: movement.id,
                                sets,
                              });
                              if (!updated) {
                                throw Error('Failed to delete set #' + movement.sets.length);
                              }

                              addSetMenu.setData(updated);
                            } catch (error) {
                              toast.error(error.message);
                            }
                          }}
                          startIcon={<BackspaceOutlined />}
                          size="small"
                        >
                          Clear Last
                        </Button>

                        <Button
                          disabled={isMutating}
                          sx={{ color: theme => theme.palette.text.primary }}
                          onClick={async function deleteAllMovementSets() {
                            if (!window.confirm('Delete all sets?')) return;

                            try {
                              const updated = await MovementsMutationAPI.update({
                                id: movement.id,
                                sets: [],
                              });
                              if (!updated) {
                                throw Error('Failed to delete all sets');
                              }
                              addSetMenu.setData(updated);
                              addSetMenu.onClose();
                            } catch (error) {
                              toast.error(error.message);
                            }
                          }}
                          startIcon={<DeleteForeverOutlined />}
                          size="small"
                        >
                          Clear Sets
                        </Button>
                      </>
                    )}

                    <Button
                      disabled={isMutating}
                      sx={{ color: theme => theme.palette.error.main }}
                      onClick={async () => {
                        if (!window.confirm('Remove movement from training log')) return;

                        try {
                          await MovementsMutationAPI.delete(movement.id);

                          addSetMenu.onClose();
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                      startIcon={<PlaylistRemove />}
                      size="small"
                    >
                      Remove
                    </Button>

                    <Button
                      disabled={isMutating}
                      sx={{ color: theme => theme.palette.text.secondary }}
                      onClick={async () => {
                        const newName = window.prompt('Update movement name', movement.name) || '';
                        if (newName.length < 3 || newName === movement.name) {
                          return;
                        }

                        try {
                          const updated = await MovementsMutationAPI.update({
                            id: movement.id,
                            name: newName,
                          });
                          addSetMenu.setData(updated);

                          addSetMenu.onClose();
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                      startIcon={<Title />}
                      size="small"
                    >
                      Rename
                    </Button>

                    <Button
                      disabled={isMutating}
                      sx={{
                        color: theme => theme.palette.text.secondary,
                      }}
                      onClick={event => {
                        const sm = {
                          id: movement.savedMovementId,
                          name: movement.savedMovementName,
                        };
                        savedMovementDrawer.onOpen(event, sm);
                        setTabValue(TabIndex.History);
                        addSetMenu.onClose();
                      }}
                      startIcon={<History />}
                      size="small"
                    >
                      History
                    </Button>

                    <Button
                      disabled={isMutating}
                      sx={{
                        color: theme => theme.palette.text.secondary,
                      }}
                      onClick={async () => {
                        if (!DataState.isReady(savedMovements)) {
                          return;
                        }

                        const sm = savedMovements.find(_ => _.id === movement.savedMovementId);
                        if (!sm) {
                          toast.error('Unreachable: updating Movement with no parent SavedMovement');
                          return;
                        }

                        const note = window.prompt('Add notes', sm.note) ?? '';
                        if (note === sm.note) {
                          return;
                        }

                        try {
                          await SavedMovementsAPI.update({ note, id: sm.id });

                          addSetMenu.onClose();
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                      startIcon={<DriveFileRenameOutline />}
                      size="small"
                    >
                      Note
                    </Button>

                    {/**
                         Find and Replace Movement
                         Disabled for now, haven't been using it
                         And the functionality exists already via: Delete -> Add Movement

                         <IconButton
                         disabled={isMutating}
                         sx={{ color: theme => theme.palette.error.main }}
                         onClick={event => { addMovementDrawer.onOpen(event, movement); }}
                         size="small"
                         >
                         <FindReplaceRounded />
                         </IconButton>
                         */}
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
        disableBackdropTransition
        onClose={async () => {
          addMovementDrawer.onClose();

          // clear input on close, after delay to avoid UI jank
          await new Promise(wait => setTimeout(wait, 150));
          setMovementNameQuery('');
        }}
      >
        <Stack spacing={1}>
          <Box>
            {/** FocusLock-ed things are in a Box to to prevent bug with Stack spacing. */}
            <ReactFocusLock
              disabled={!addMovementDrawer.open || savedMovementDrawer.open}
              returnFocus
            >
              <TextField
                fullWidth
                variant="standard"
                helperText={<b>Select a movement or create one</b>}
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

          <DataStateView
            data={matches}
            loading={() => (
              <Stack>
                <Skeleton width="50%" height="55px" />
                <Skeleton width="30%" height="55px" />
                <Skeleton width="80%" height="55px" />
                <Skeleton width="20%" height="55px" />
                <Skeleton width="30%" height="55px" />
              </Stack>
            )}
          >
            {matches => {
              const queryIsEmpty = movementNameQuery === '';
              const query = movementNameQuery.toLowerCase();
              const hasFoundExactName = matches.some(_ => _.name === query);
              const hasFuzzyNameMatch = matches.some(_ => _.name.toLowerCase().includes(query));
              // const isReplacingMovement = !!addMovementDrawer.getData();

              return (
                <>
                  <Collapse in={(matches.length > 0 && queryIsEmpty) || hasFuzzyNameMatch}>
                    <Stack spacing={1} sx={{ maxHeight: '35vh', overflowY: 'scroll' }}>
                      {matches.map((match: SavedMovement) => {
                        // A string like "22h ago" or "4d ago"
                        const distance = formatDistanceToNowStrict(new Date(match.lastSeen), {
                          addSuffix: true,
                        })
                          .replace(/ (\w)\w+ /i, '$1 ')
                          .replace('m ', 'mo ');

                        const isLessThan72HoursAgo =
                          new Date().getTime() - new Date(match.lastSeen).getTime() <
                          72 * 60 * 60 * 1000;

                        return (
                          <Box
                            key={match.id}
                            display="flex"
                            justifyContent="space-between"
                            sx={
                              {
                                // cursor: 'pointer',
                                // borderBottom: theme => `1px solid ${theme.palette.divider}`,
                              }
                            }
                          >
                            <Box display="flex" justifyContent="center">
                              <ChevronRightRounded
                                sx={{
                                  color: theme => theme.palette.text.secondary,
                                  display: 'flex',
                                  height: '100%',
                                }}
                              />

                              <ButtonBase
                                disabled={isMutatingPlus}
                                sx={{
                                  backgroundColor: theme => theme.palette.divider,
                                  color: theme => theme.palette.text.primary,
                                  fontSize: '1.0rem',
                                  padding: '8px 11px',
                                  fontWeight: 600,
                                  borderRadius: 1,
                                }}
                                onClick={async () => {
                                  const movement = addMovementDrawer.getData();
                                  if (movement === null) {
                                    return addMovementFromExistingSavedMovement(match);
                                  }

                                  if (!DataState.isReady(movements)) return;
                                  if (movements.some(_ => _.savedMovementId === match.id)) {
                                    return toast.info(`${match.name} has already been added`);
                                  }

                                  const { position } = movement;
                                  try {
                                    await Promise.all([
                                      MovementsMutationAPI.delete(movement.id),
                                      addMovementFromExistingSavedMovement(match, { position }),
                                    ]);
                                  } catch (error) {
                                    toast.error(error.message);
                                  }
                                }}
                              >
                                {match.name}
                              </ButtonBase>
                            </Box>

                            <Stack
                              sx={{ whiteSpace: 'nowrap', alignItems: 'center' }}
                              spacing={1}
                              direction="row"
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: theme =>
                                    isLessThan72HoursAgo
                                      ? theme.palette.text.secondary
                                      : theme.palette.success.main,
                                }}
                              >
                                {distance}
                              </Typography>

                              <IconButton
                                sx={{ color: theme => theme.palette.text.secondary }}
                                onClick={event => {
                                  savedMovementDrawer.onOpen(event, match);
                                  addMovementDrawer.onClose();
                                }}
                              >
                                <MoreHoriz />
                              </IconButton>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Collapse>

                  {movementNameQuery.length > 2 && !hasFoundExactName && (
                    <Box>
                      <Button
                        sx={{
                          justifyContent: 'flex-start',
                          // backgroundColor: 'transparent',
                          // border: theme => `1px solid ${theme.palette.divider}`,
                          color: theme => theme.palette.text.secondary,
                          fontWeight: 600,
                          fontSize: '1.0rem',
                          // padding: '8px 11px',
                        }}
                        startIcon={<Add fontSize="small" />}
                        onClick={addMovementFromNewSavedMovement}
                        disabled={isMutating}
                      >
                        Create {movementNameQuery}
                      </Button>
                    </Box>
                  )}
                </>
              );
            }}
          </DataStateView>
        </Stack>
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
                <ReactFocusLock disabled={!savedMovementDrawer.open}>
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
                  startIcon={<RemoveCircleOutline />}
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
            {!!historyLogDrawer.getData() && (
              <EditorInternals readOnly logId={historyLogDrawer.getData()!.logId} />
            )}
          </Box>
        </Collapse>
      </SwipeableDrawer>

      <SwipeableDrawer
        {...accountDrawer}
        anchor="left"
        variant={pinned ? 'permanent' : 'temporary'}
        PaperProps={{
          onMouseLeave: pinned ? undefined : accountDrawer.onClose,
          sx: {
            padding: theme => theme.spacing(1, 1.25, 2, 1.25),
            boxShadow: 'none',
            border: 'none',
            backgroundColor: theme =>
              darken(theme.palette.background.default, prefersDark ? 0.3 : 0.03),
          },
        }}
      >
        <AccountPanel
          title={DataState.isReady(log) ? dateDisplay(new Date(log.timestamp)) : ''}
          pinned={pinned}
          setPinned={setPinned}
          logId={logId}
          onClose={accountDrawer.onClose}
        />
      </SwipeableDrawer>

      <SwipeableDrawer {...logDrawer.props()} anchor="right">
        <Collapse in={logDrawer.open}>
          <Stack
            spacing={3}
            sx={{
              width: isMobile ? '78vw' : '268px',
            }}
          >
            <TextField
              variant="outlined"
              label="Body Weight"
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
                  toast.info('Updated bodyweight');
                } catch (error) {
                  toast.error(error.message);
                }
              }}
            />
            <Button
              variant="text"
              disabled={!DataState.isReady(log)}
              startIcon={<NoteAltOutlined />}
              size="large"
              sx={{
                // text align left
                justifyContent: 'flex-start',
                color: theme => theme.palette.text.secondary,
                fontWeight: 600,
              }}
              onClick={event => {
                if (!DataState.isReady(log)) return;

                logDrawer.onClose();
                notesDrawer.onOpen(event, log);
              }}
            >
              Note
            </Button>
            <Button
              variant="text"
              disabled={!DataState.isReady(log)}
              startIcon={<Link />}
              size="large"
              sx={{
                justifyContent: 'flex-start',
                color: theme => theme.palette.text.secondary,
                fontWeight: 600,
              }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  logDrawer.onClose();

                  toast.info('Copied link to clipboard');
                } catch (err) {
                  toast.error(err.message);
                }
              }}
            >
              Copy link
            </Button>
            <Button
              variant="text"
              disabled={!DataState.isReady(log)}
              startIcon={<CopyAll />}
              size="large"
              sx={{
                justifyContent: 'flex-start',
                color: theme => theme.palette.text.secondary,
                fontWeight: 600,
              }}
              onClick={async () => {
                if (!DataState.isReady(log)) return;
                if (!DataState.isReady(movements)) return;
                if (!window.confirm('Duplicate this Training?')) return;

                // duplicate log and its sets
                try {
                  const newLog = await TrainingLogsAPI.create({
                    timestamp: Date.now(),
                    authorUserId: user.uid,
                    bodyweight: log.bodyweight,
                    isFinished: false,
                    note: '',
                    programId: log.programId,
                    programLogTemplateId: log.programLogTemplateId,
                  });

                  const logMovements: Movement[] = movements.map(movement => ({
                    ...movement,
                    logId: newLog.id,
                    sets: movement.sets.map(s => ({ ...s, uuid: uuidv4() })),
                    timestamp: Date.now(),
                  }));
                  await MovementsAPI.createMany(logMovements);

                  navigate(Paths.editor(newLog.id, TrainingLog.title(newLog)));
                  toast.info('Duplicated training log');
                  logDrawer.onClose();
                } catch (err) {
                  toast.error(err.message);
                }
              }}
            >
              Duplicate
            </Button>
            <Button
              onClick={async () => {
                if (!logId) throw Error('Unreachable');
                if (!window.confirm('Delete Training?')) return;
                try {
                  await Promise.all([
                    TrainingLogsAPI.delete(logId),
                    MovementsAPI.deleteMany(where('logId', '==', logId)),
                  ]);

                  logDrawer.onClose();
                  toast.info('Deleted training');

                  // navigate to the nearest existing log
                  if (DataState.isReady(logs) && logs.length > 1) {
                    const [first] = logs.filter(_ => _.id !== logId);
                    navigate(Paths.editor(first.id, TrainingLog.title(first)));
                  } else {
                    navigate(Paths.editor(''));
                  }
                } catch (error) {
                  toast.error(error.message);
                }
              }}
              startIcon={<DeleteForeverOutlined fontSize="large" />}
              size="large"
              sx={{
                justifyContent: 'flex-start',
                color: theme => theme.palette.text.secondary,
                fontWeight: 600,
              }}
            >
              Delete
            </Button>
          </Stack>
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
    </main>
  );
};

const MovementSetView: FC<{
  isProgramView: boolean;
  movementSet: MovementSet;
  movement: Movement;
  index: number;
}> = ({ movementSet, movement, index, isProgramView }) => {
  const resizeWeightInput = useResizableInputRef();
  const theme = useTheme();
  const toast = useToast();
  const MovementsMutationAPI = useStore(store =>
    isProgramView ? store.ProgramMovementsAPI : store.MovementsAPI
  );
  // check if there's an ongoing mutation if it was mutating previously
  // hopefully solves issue where slow networks can multi-add movements (bad UX)
  const isMutating = useIsMutating() > 0;

  const repsDrawer = useDrawer<undefined>();

  const [repsActual, setRepsActual] = useState(movementSet.repCountActual);
  const [weight, setWeight] = useState(movementSet.weight);
  // const [confetti, setConfetti] = useState(false);

  const setIsCompleted = movementSet.status === MovementSetStatus.Completed;
  const singularRepDisplay =
    typeof movementSet.repCountMaxExpected === 'undefined' ||
    setIsCompleted ||
    movementSet.repCountExpected === movementSet.repCountMaxExpected;

  const updateSets = useCallback(
    async (sets: MovementSet[]) => {
      try {
        await MovementsMutationAPI.update({ id: movement.id, sets });
      } catch (error) {
        toast.error(error.message);
      }
    },
    [MovementsMutationAPI, toast, movement.id]
  );

  const cycleMovementSet = useCallback(
    async event => {
      event.stopPropagation();

      if (movementSet.status === MovementSetStatus.Completed) {
        repsDrawer.onOpen(event, void 0);

        event.currentTarget?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });

        return;
      }

      if (movementSet.status === MovementSetStatus.Unattempted) {
        movement.sets[index].repCountActual = movementSet.repCountMaxExpected;
        movement.sets[index].status = MovementSetStatus.Completed;

        try {
          await updateSets([...movement.sets]);
        } catch (err) {
          toast.error(err.message);
        }
      }
    },
    [index, movement.sets, movementSet, toast, updateSets, repsDrawer]
  );

  const handleSubmit = useCallback(
    async event => {
      event.preventDefault();

      movement.sets[index].repCountActual = repsActual;

      try {
        await updateSets([...movement.sets]);

        repsDrawer.onClose();
      } catch (err) {
        toast.error(err.message);
      }
    },
    [toast, updateSets, index, movement.sets, repsDrawer, repsActual]
  );

  return (
    <>
      <Backdrop
        open={repsDrawer.open}
        onClick={_ => _.stopPropagation()}
        sx={{ backgroundColor: 'transparent' }}
      >
        <Menu
          open={repsDrawer.open}
          anchorEl={repsDrawer.anchorEl}
          onClose={() => {
            repsDrawer.onClose();
            setRepsActual(0);
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <Stack spacing={1} sx={{ padding: theme.spacing(0, 1) }}>
            <Typography variant="subtitle2">How many reps were completed?</Typography>

            <Stack direction="row" spacing={2}>
              <Box component="form" onSubmit={handleSubmit}>
                <ReactFocusLock disabled={!repsDrawer.open}>
                  <input
                    type="tel"
                    min={0}
                    max={movementSet.repCountMaxExpected}
                    name="repsActual"
                    value={repsActual}
                    readOnly={isProgramView}
                    disabled={isProgramView}
                    style={{
                      color: theme.palette.text.primary,
                      backgroundColor: theme.palette.background.paper,
                      width: '3ch',
                      margin: '0 auto',
                      // border: `1px solid ${theme.palette.text.secondary}`,
                      border: 0,
                      outline: 'none',
                      fontFamily: 'monospace',
                      borderRadius: 5,
                      padding: theme.spacing(1, 2),
                      fontWeight: 600,
                      fontSize: '1.3rem',
                      letterSpacing: 0.5,
                    }}
                    onSubmit={handleSubmit}
                    onClick={event => {
                      event.stopPropagation();

                      event.currentTarget.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest',
                      });
                    }}
                    onFocus={event => {
                      event.currentTarget.select();
                    }}
                    onChange={event => {
                      if (Number.isNaN(event.target.value)) {
                        return;
                      }

                      setRepsActual(Number(event.target.value));
                    }}
                  />
                </ReactFocusLock>
              </Box>

              <Button
                sx={{
                  color: theme => theme.palette.text.primary,
                  border: theme => `1px solid ${theme.palette.divider}`,
                  fontWeight: 600,
                  letterSpacing: 0,
                }}
                startIcon={<CheckRounded fontSize="large" />}
                onClick={async () => {
                  try {
                    movement.sets[index].repCountActual = repsActual;

                    repsDrawer.onClose();

                    await updateSets([...movement.sets]);
                  } catch (err) {
                    toast.error(err.message);
                  }
                }}
              >
                Save
              </Button>

              <Button
                sx={{
                  color: theme => theme.palette.text.secondary,
                  fontWeight: 600,
                  letterSpacing: 0,
                }}
                startIcon={<RefreshRounded />}
                onClick={async () => {
                  try {
                    movement.sets[index].status = MovementSetStatus.Unattempted;
                    movement.sets[index].repCountActual = movementSet.repCountMaxExpected;

                    repsDrawer.onClose();

                    await updateSets([...movement.sets]);
                  } catch (err) {
                    toast.error(err.message);
                  }
                }}
              >
                Reset
              </Button>

              <Button
                sx={{
                  color: theme => theme.palette.text.secondary,
                  fontWeight: 600,
                  letterSpacing: 0,
                  ':hover': {
                    color: theme => theme.palette.error.main,
                  },
                }}
                startIcon={<RemoveCircleOutline />}
                disabled={isMutating}
                onClick={async () => {
                  if (isMutating) {
                    toast.info('Try again in a few seconds');
                    return;
                  }

                  try {
                    repsDrawer.onClose();

                    await MovementsMutationAPI.update({
                      id: movement.id,
                      sets: movement.sets.filter((_, i) => i !== index),
                    });
                  } catch (err) {
                    toast.error(err.message);
                  }
                }}
              >
                Delete
              </Button>
            </Stack>
          </Stack>
        </Menu>
      </Backdrop>

      <Fade in>
        <Stack spacing={0.25}>
          <Box
            sx={{
              borderBottom: 'none',
              textAlign: 'center',
              alignItems: 'center',
              borderRadius: 2,
            }}
          >
            <input
              ref={resizeWeightInput}
              type="tel"
              min={0}
              max={9999}
              name="weight"
              value={weight}
              readOnly={isProgramView}
              disabled={isProgramView}
              onClick={event => {
                event.stopPropagation();
              }}
              onFocus={event => {
                event.currentTarget.select();
              }}
              onChange={event => {
                if (Number.isNaN(event.target.value)) {
                  return;
                }
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
                color:
                  movementSet.status === MovementSetStatus.Unattempted
                    ? theme.palette.text.primary
                    : theme.palette.success.light,
                backgroundColor: 'transparent',
                width: '3ch',
                border: 'none',
                outline: 'none',
                margin: '0 auto',
                padding: '4px 11px',
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '1.1rem',
                letterSpacing: 0.5,
              }}
            />
          </Box>

          <Button
            disabled={isProgramView}
            sx={{
              padding: `11px 16px`,
              textAlign: 'center',
              fontSize: singularRepDisplay ? '1.5rem' : '1.1rem',
              fontWeight: 500,
              letterSpacing: 0,
              whiteSpace: 'nowrap',
              height: '64px',
              minHeight: 'auto',
              borderRadius: 2,

              ...(setIsCompleted
                ? {
                  backgroundColor: alpha(theme.palette.success.light, 0.11),
                  color: theme.palette.success.light,
                }
                : {
                  backgroundColor: alpha(theme.palette.divider, 0.08),
                  color: theme.palette.text.primary,
                }),
            }}
            onClick={cycleMovementSet}
          >
            {singularRepDisplay ? (
              <>{movementSet.repCountActual}</>
            ) : (
              <>
                {movementSet.repCountExpected} {DIFF_CHAR} {movementSet.repCountMaxExpected}
              </>
            )}
          </Button>
        </Stack>
      </Fade>
    </>
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
      style: { padding: '8px 11px' },
    }}
    sx={{
      color: theme => theme.palette.primary.main,
      textTransform: 'capitalize',
      fontSize: '0.9rem',
      fontWeight: 500,
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
  const heaviestDate: Date[] = [];
  for (const movement of movementsHistory) {
    for (const set of movement.sets) {
      if (set.weight >= heaviest) {
        heaviest = set.weight;
        heaviestDate.push(new Date(movement.timestamp));
      }
    }
  }

  return (
    <Stack spacing={1}>
      <Typography variant="h6" fontWeight="bold">
        {savedMovement.name}
      </Typography>

      {!!heaviest && !!heaviestDate.length && (
        <Typography variant="caption">
          Heaviest was {heaviest}
          {movementsHistory[0].weightUnit} on {heaviestDate.map(_ => dateDisplay(_)).join(', ')}.
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

import {
  AddRounded,
  Close,
  DeleteForeverRounded,
  EditOutlined,
  PersonOutline,
  VerifiedRounded,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Stack,
  SwipeableDrawer,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { orderBy, where } from 'firebase/firestore';
import { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate } from 'react-router-dom';

import { API } from '../api';
import { WithVariable } from '../components';
import { useUser } from '../context';
import { Movement, Program } from '../types';
import {
  DataState,
  DataStateView,
  Paths,
  SORTED_WEEKDAYS,
  useDataState,
  useDrawer,
  useMaterialMenu,
  useToast,
  Weekdays,
} from '../util';
import { EditorInternals } from './Editor';

enum TabIndex {
  /** List of programs view. */
  Programs = 0,
  /** Scheduled movements by day of week view. */
  Schedule = 1,
}

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const addProgramDrawer = useMaterialMenu();
  const editorDrawer = useDrawer<{
    templateId: null | string;
    dayOfWeek: Lowercase<Weekdays>;
    index: number;
  }>();

  const [newProgramName, setNewProgramName] = useState('');
  const [tabValue, setTabValue] = useState(TabIndex.Programs);
  const [viewedProgram, setViewedProgram] = useState<Program | null>(null);

  // Currently only user-local programs are shown, NOT all programs ever made
  // in the app What if we allow non-user-local programs and the owner deletes
  // one while it is still in use? What if the owner updates the name? Should
  // non-user-owned programs be copied into their own DB collection upon
  // activation? What if they were just testing it out and switch back quickly?
  // Being lazy on this decision and implementing the least amount possible in
  // order to work is the way we should go. Or, it will likely become obvious
  // with little effort in the future.
  const [programs, setPrograms] = useDataState(() => API.Programs.getAll(user.uid), [user.uid]);

  const [programUser, setProgramUser] = useDataState(
    () =>
      API.ProgramUsers.getAll(where('userUid', '==', user.uid)).then(users => {
        // If there is no entry in ProgramUsers for the current user, create
        // one and use that to keep track of the active program for the user.
        // Programs cannot be unselected.
        if (users.length > 0) {
          // There can ONLY BE ONE!
          if (users.length > 1) {
            users.slice(1).forEach(_ => API.ProgramUsers.delete(_.id));
          }
          return users[0];
        }
        return API.ProgramUsers.create({
          userUid: user.uid,
          activeProgramId: null,
          activeProgramName: null,
        });
      }),
    [user.uid]
  );

  // When page loads viewedProgram is null, when data fetches, update
  // viewedProgram so the Schedule tab is not disabled.
  useEffect(() => {
    if (!DataState.isReady(programUser)) return;
    if (!DataState.isReady(programs)) return;
    if (viewedProgram === null && typeof programUser.activeProgramId === 'string') {
      setViewedProgram(programs.find(p => p.id === programUser.activeProgramId) ?? null);
    }
  }, [programUser, programs, viewedProgram]);

  // ProgramMovements from viewedProgram
  const [programMovementsByDayOfWeek] = useDataState<
    Record<Lowercase<Weekdays[number]>, null | Movement[]>
  >(async () => {
    if (editorDrawer.open) return DataState.Empty;
    const program = viewedProgram;
    if (!program) return DataState.Empty;
    const promises = Object.keys(program.daysOfWeek).map(async key => {
      const dayOfWeek = key as Lowercase<Weekdays>;
      const templateId = program.daysOfWeek[dayOfWeek];
      if (!templateId) {
        return { [dayOfWeek]: null };
      }
      return API.ProgramMovements.getAll(
        where('logId', '==', templateId),
        orderBy('position', 'asc')
      ).then(movements => ({ [dayOfWeek]: movements }));
    });
    return await Promise.all(promises).then(_ => _.reduce((R, x) => Object.assign(R, x), {}));
  }, [editorDrawer.open, viewedProgram]);

  const [newTemplateId] = useDataState(async () => {
    if (!editorDrawer.open) return DataState.Empty;
    const program = viewedProgram;
    const data = editorDrawer.getData();
    if (!DataState.isReady(programs)) return programs;
    if (!data || !program) return DataState.Empty;
    if (data.templateId) {
      return data.templateId;
    }
    // Create one and return it
    const { id: newProgramLogTemplateId } = await API.ProgramLogTemplates.create({
      authorUserId: user.uid,
      programId: program.id,
    });
    // Update programs to reflect newly added day of week (in the drawer-open program)
    const daysOfWeek = JSON.parse(JSON.stringify(program.daysOfWeek));
    daysOfWeek[data.dayOfWeek] = newProgramLogTemplateId;
    const updated = await API.Programs.update({
      id: program.id,
      daysOfWeek,
    });
    setPrograms(programs.map(p => (p.id === program.id ? updated : p)));
    // Update drawer state to reflect DB
    editorDrawer.setData({ ...data, templateId: newProgramLogTemplateId });
    // Return new template (id) for users to add movements to since they just
    // clicked the (add template) button
    return newProgramLogTemplateId;
  }, [editorDrawer.getData()?.templateId, viewedProgram]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateActiveProgram = useCallback(
    async (program: Program) => {
      if (!DataState.isReady(programUser)) {
        toast.error('Program user not found or ready.');
        return;
      }
      try {
        const updated = await API.ProgramUsers.update({
          activeProgramName: program.name,
          activeProgramId: program.id,
          id: programUser.id,
        });
        setProgramUser(updated);
        toast.success('Updated active program.');
      } catch (err) {
        toast.error(err.message);
      }
    },
    [programUser, toast, setProgramUser]
  );

  return (
    <>
      <Box
        sx={{
          height: '100vh',
          width: '100vw',
          padding: theme => theme.spacing(1),
        }}
      >
        <Stack direction="row" width="100" justifyContent="space-between" alignItems="center">
          <IconButton onClick={() => navigate(Paths.home)} color="primary">
            <PersonOutline />
          </IconButton>
          <Stack>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, next) => setTabValue(next)} aria-label="tabs">
                <Tab
                  label="Programs"
                  {...a11yProps(TabIndex.Programs)}
                  onClick={() => {
                    // when clicking Programs tab - back from Schedule tab - ensure the program
                    // seen when navigating *back* to Schedule tab is the user's active program.
                    if (!DataState.isReady(programs)) return;
                    if (!DataState.isReady(programUser)) return;
                    setViewedProgram(
                      prev => programs.find(p => p.id === programUser.activeProgramId) || prev
                    );
                  }}
                />
                <Tab label="Schedule" {...a11yProps(TabIndex.Schedule)} disabled={!viewedProgram} />
              </Tabs>
            </Box>
          </Stack>
          <Button startIcon={<AddRounded />} onClick={addProgramDrawer.onOpen}>
            New
          </Button>
        </Stack>

        <TabPanel value={tabValue} index={TabIndex.Programs}>
          <DataStateView data={programs}>
            {programs =>
              programs.length === 0 ? (
                <Typography variant="overline" sx={{ textAlign: 'center' }}>
                  Nothing yet
                </Typography>
              ) : (
                <Stack spacing={3}>
                  {programs.map(program => {
                    const isActive =
                      DataState.isReady(programUser) && programUser.activeProgramId === program.id;
                    return (
                      <Box
                        key={program.id}
                        sx={{
                          padding: theme => theme.spacing(2),
                          backgroundColor: theme => theme.palette.divider,
                          borderRadius: 2,
                          minHeight: '12vh',
                          ...(isActive
                            ? { border: theme => `1px solid ${theme.palette.primary.main}` }
                            : {}),
                        }}
                        onClick={() => {
                          setViewedProgram(program);
                          // Navigate user to tab which shows the program details
                          setTabValue(TabIndex.Schedule);
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between">
                          <Typography
                            variant="h6"
                            sx={{ color: isActive ? 'text.primary' : 'text.secondary' }}
                            fontWeight={200}
                          >
                            {program.name}
                          </Typography>
                          {isActive && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle2" sx={{ opacity: 1.0 }}>
                                Active
                              </Typography>
                              <VerifiedRounded />
                            </Stack>
                          )}
                        </Stack>
                        <WithVariable
                          value={SORTED_WEEKDAYS.flatMap(key =>
                            program.daysOfWeek[key.toLowerCase()] ? key.slice(0, 3) : []
                          )}
                        >
                          {programDays => (
                            <Box
                              width="100%"
                              justifyContent="space-between"
                              display="flex"
                              alignItems="baseline"
                            >
                              <Typography variant="caption" color="textSecondary">
                                {programDays.length}x/week
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                <b>{programDays.join(', ')}</b>
                              </Typography>
                            </Box>
                          )}
                        </WithVariable>
                      </Box>
                    );
                  })}
                </Stack>
              )
            }
          </DataStateView>
        </TabPanel>

        <TabPanel value={tabValue} index={TabIndex.Schedule}>
          <WithVariable value={viewedProgram}>
            {program => {
              if (program === null) {
                return <>Nothing to show here.</>;
              }
              const isActive =
                DataState.isReady(programUser) && programUser.activeProgramId === program?.id;
              const isOwner = user.uid === program.authorUserId;
              return (
                <Stack spacing={3}>
                  <Stack
                    spacing={1}
                    direction="row"
                    sx={{ justifyContent: 'center', width: '100%' }}
                  >
                    <Typography variant="overline" color="textSecondary" lineHeight={1}>
                      {isActive ? 'Active ' : ''}Program:
                    </Typography>
                    <Typography variant="overline" lineHeight={1}>
                      {program.name}
                    </Typography>
                  </Stack>
                  {/** Title or Edit input with Delete button if owner */}
                  {isOwner && isActive && DataState.isReady(programs) && (
                    <Stack direction="row">
                      <Stack direction="row" spacing={2} alignItems="center" width="100%">
                        <TextField
                          fullWidth
                          variant="standard"
                          defaultValue={program.name}
                          onBlur={async function editProgramName(event) {
                            try {
                              const newName = event.target.value;
                              if (newName.length < 3 || newName === program.name) return;
                              const updated = await API.Programs.update({
                                id: program.id,
                                name: newName,
                              });
                              setPrograms(programs.map(p => (p.id === program.id ? updated : p)));
                              toast.info('Updated program name.');
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }}
                        />
                        <IconButton
                          color="error"
                          onClick={async function deleteProgram() {
                            if (!DataState.isReady(programMovementsByDayOfWeek)) {
                              throw Error('Unreachable');
                            }
                            if (!window.confirm('Are you sure? This can never be undone.')) return;
                            try {
                              const _deleteProgram = API.Programs.delete(program.id);
                              const _updateProgramUser = API.ProgramUsers.update({
                                id: programUser.id,
                                activeProgramId: null,
                                activeProgramName: null,
                              });
                              const _deleteProgramLogTemplates = API.ProgramLogTemplates.deleteMany(
                                where('programId', '==', program.id)
                              );
                              const _deleteProgramMovements = Promise.all(
                                Object.values(program.daysOfWeek)
                                  .filter(templateId => !!templateId)
                                  .map(_ =>
                                    API.ProgramMovements.deleteMany(where('logId', '==', _))
                                  )
                              );
                              await Promise.all([
                                _deleteProgram,
                                _updateProgramUser,
                                _deleteProgramLogTemplates,
                                _deleteProgramMovements,
                              ]);
                              setPrograms(programs.filter(p => p.id !== program.id));
                              setViewedProgram(null);
                              setTabValue(TabIndex.Programs);
                              toast.success('Deleted program.');
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }}
                        >
                          <DeleteForeverRounded fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  )}
                  {!isActive && (
                    <Button
                      fullWidth
                      variant="text"
                      disabled={isActive}
                      onClick={() => {
                        const program = viewedProgram;
                        if (!program || !DataState.isReady(programUser)) {
                          throw Error('Unreachable: ProgramUser not ready.');
                        }
                        const { activeProgramId, activeProgramName } = programUser;
                        if (activeProgramId === program.id) {
                          toast.info('Program is already active.');
                        }
                        if (
                          typeof activeProgramId === 'string' &&
                          !window.confirm(`Switch from ${activeProgramName} to ${program.name}?`)
                        ) {
                          return;
                        }
                        updateActiveProgram(program);
                      }}
                    >
                      Make active program
                    </Button>
                  )}
                  <Stack spacing={1.5}>
                    {[
                      program.daysOfWeek.sunday,
                      program.daysOfWeek.monday,
                      program.daysOfWeek.tuesday,
                      program.daysOfWeek.wednesday,
                      program.daysOfWeek.thursday,
                      program.daysOfWeek.friday,
                      program.daysOfWeek.saturday,
                    ].map((programLogTemplateId: string | null, index, array) => {
                      const dayOfWeek = Object.keys(Weekdays)[
                        index
                      ].toLowerCase() as Lowercase<Weekdays>;
                      const dayIndex = array.slice(0, index).filter(Boolean).length + 1;
                      const dayHasTraining = !!programLogTemplateId;
                      return (
                        <Box
                          key={dayOfWeek}
                          sx={{
                            padding: theme => theme.spacing(1, 2),
                            border: theme => `2px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            ...(dayHasTraining
                              ? { backgroundColor: theme => theme.palette.divider }
                              : {}),
                          }}
                        >
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="center"
                            spacing={2}
                          >
                            <Typography
                              variant="overline"
                              color={dayHasTraining ? 'textPrimary' : 'textSecondary'}
                              lineHeight={1}
                              whiteSpace="nowrap"
                              mr={dayHasTraining ? -0.2 : undefined}
                            >
                              {dayHasTraining ? `Day ${dayIndex}` : 'Rest'}
                            </Typography>
                            <Stack width="100%">
                              <Typography
                                fontWeight={200}
                                fontStyle={dayHasTraining ? 'italic' : void 0}
                              >
                                {dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}
                              </Typography>
                              <DataStateView data={programMovementsByDayOfWeek}>
                                {schedule => {
                                  const movements = schedule[dayOfWeek];
                                  // Ensure value is not null AND if it is an array, it is not empty
                                  if (movements === null) {
                                    return null;
                                  }
                                  if (movements.length === 0) {
                                    // Unreachable because tempaltes with zero movements are supposed
                                    // to be deleted upon closing of the editor drawer
                                    // toast.error('Unreachable: Template with zero movements.');
                                    return null;
                                  }
                                  return (
                                    <Typography
                                      variant="body2"
                                      fontWeight={600}
                                      key={movements.toString()}
                                    >
                                      {movements.map(_ => _.name).join(', ')}
                                    </Typography>
                                  );
                                }}
                              </DataStateView>
                            </Stack>
                            <IconButton
                              sx={{ color: theme => theme.palette.primary.main }}
                              onClick={event => {
                                editorDrawer.onOpen(event, {
                                  templateId: programLogTemplateId,
                                  dayOfWeek,
                                  index: dayIndex,
                                });
                              }}
                            >
                              {dayHasTraining ? <EditOutlined /> : <AddRounded />}
                            </IconButton>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Stack>
              );
            }}
          </WithVariable>
        </TabPanel>
      </Box>

      {/** ----------------------------- DRAWERS ----------------------------- */}

      <SwipeableDrawer
        {...editorDrawer.props()}
        anchor="bottom"
        onClose={async () => {
          if (!DataState.isReady(programs)) return;
          const context = editorDrawer.getData();
          if (!!context && !!viewedProgram) {
            const { templateId, dayOfWeek } = context;
            // const dayPreviouslyDidNotHaveTraining = !!viewedProgram?.daysOfWeek[dayOfWeek]
            if (!templateId) return;
            // If no movements exist in the training template, then delete the
            // template from the schedule
            const movements = await API.ProgramMovements.getAll(where('logId', '==', templateId));
            if (movements.length === 0) {
              const nextDaysOfWeek = Object.assign(viewedProgram.daysOfWeek, { [dayOfWeek]: null });
              const [, updated] = await Promise.all([
                API.ProgramLogTemplates.delete(templateId),
                API.Programs.update({
                  id: viewedProgram.id,
                  daysOfWeek: nextDaysOfWeek,
                }),
              ]);
              setPrograms(programs.map(p => (p.id === viewedProgram.id ? updated : p)));
            } else {
              // Update viewedProgram which updates movement names display
              setViewedProgram({
                ...viewedProgram,
                daysOfWeek: { ...viewedProgram.daysOfWeek, [dayOfWeek]: templateId },
              });
            }
          }
          editorDrawer.onClose();
        }}
      >
        <Collapse in={editorDrawer.open}>
          <Box height="80vh">
            <WithVariable value={editorDrawer.getData()}>
              {drawerData => {
                if (!drawerData) {
                  return null;
                }
                const { dayOfWeek, templateId, index } = drawerData;
                const capitalized = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
                const name = `${capitalized}, Day ${index}`;

                return (
                  <Stack spacing={0.5}>
                    <Typography variant="overline" width="100%" textAlign="center" sx={{ mt: -1 }}>
                      {name}
                    </Typography>
                    <Box
                      sx={{
                        height: '100%',
                        width: '100%',
                        overflowY: 'scroll',
                      }}
                    >
                      {templateId === null ? (
                        <DataStateView data={newTemplateId}>
                          {id => <EditorInternals isProgramView logId={id} />}
                        </DataStateView>
                      ) : (
                        <EditorInternals isProgramView logId={templateId} />
                      )}
                    </Box>
                  </Stack>
                );
              }}
            </WithVariable>
          </Box>
        </Collapse>
      </SwipeableDrawer>

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
                    <Close />
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
              if (!DataState.isReady(programs)) return;
              try {
                const created = await API.Programs.create({
                  name: newProgramName,
                  authorUserId: user.uid,
                  timestamp: Date.now(),
                  daysOfWeek: {
                    monday: null,
                    tuesday: null,
                    wednesday: null,
                    thursday: null,
                    friday: null,
                    saturday: null,
                    sunday: null,
                  },
                });
                setPrograms(programs.concat(created));
                setNewProgramName('');
                // Happens after deleting then creating a new program
                // Do not keep user on "nothing to show here" case view
                if (tabValue === TabIndex.Schedule) {
                  setViewedProgram(created);
                }
                addProgramDrawer.onClose();
                toast.success('Program created!');
              } catch (error) {
                toast.error(error.message);
              }
            }}
          >
            Create Program
          </Button>
        </Stack>
      </SwipeableDrawer>
    </>
  );
};

// https://mui.com/material-ui/react-tabs/
const TabPanel: FC<{
  children: ReactNode;
  index: TabIndex;
  value: TabIndex;
}> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`program-tabpanel-${index}`}
    aria-labelledby={`program-tab-${index}`}
  >
    {value === index && (
      <Box
        sx={{
          padding: theme => theme.spacing(3, 1),
        }}
      >
        {children}
      </Box>
    )}
  </div>
);

function a11yProps(index: number) {
  return {
    id: `program-tab-${index}`,
    'aria-controls': `program-tabpanel-${index}`,
  };
}

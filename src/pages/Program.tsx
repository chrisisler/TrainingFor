import {
  AddRounded,
  Close,
  DeleteForeverRounded,
  EditOutlined,
  NavigateBeforeRounded,
  VerifiedRounded,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
} from '@mui/material';
import { orderBy, where } from 'firebase/firestore';
import { FC, useCallback, useState } from 'react';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate } from 'react-router-dom';

import { API } from '../api';
import { WithVariable } from '../components/Variable';
import { useUser } from '../context';
import { Movement, Program } from '../types';
import {
  DataState,
  DataStateView,
  Paths,
  useDataState,
  useDrawer,
  useMaterialMenu,
  useToast,
  Weekdays,
} from '../util';
import { EditorInternals } from './Editor';

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const addProgramDrawer = useMaterialMenu();
  const programDrawer = useDrawer<Program>();
  const editorDrawer = useDrawer<{
    templateId: null | string;
    dayOfWeek: Lowercase<Weekdays>;
    index: number;
  }>();

  const [newProgramName, setNewProgramName] = useState('');

  // Currently only user-local programs are shown, NOT all programs ever made
  // in the app What if we allow non-user-local programs and the owner deletes
  // one while it is still in use? What if the owner updates the name? Should
  // non-user-owned programs be copied into their own DB collection upon
  // activation? What if they were just testing it out and switch back quickly?
  // Being lazy on this decision and implementing the least amount possible in
  // order to work is the way we should go. Or, it will likely become obvious
  // with little effort in the future.
  const [programs, setPrograms] = useDataState(() => API.Programs.getAll(user.uid), []);

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
          id: '',
          userUid: user.uid,
          activeProgramId: null,
          activeProgramName: null,
        });
      }),
    [user.uid]
  );

  // ProgramMovements
  const [programMovementsByDayOfWeek] = useDataState<
    Record<Lowercase<Weekdays[number]>, null | Movement[]>
  >(async () => {
    if (editorDrawer.open) return DataState.Empty;
    const program = programDrawer.getData();
    if (!programDrawer.open || !program) return DataState.Empty;
    const promises = Object.keys(program.daysOfWeek).map(key => {
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
  }, [programDrawer.getData(), editorDrawer.open]);

  const [newTemplateId] = useDataState(async () => {
    if (!editorDrawer.open) return DataState.Empty;
    const program = programDrawer.getData();
    const data = editorDrawer.getData();
    if (!DataState.isReady(programs)) return programs;
    if (!data || !program) return DataState.Empty;
    if (data.templateId) {
      return data.templateId;
    }
    // Create one and return it
    const { id: newProgramLogTemplateId } = await API.ProgramLogTemplates.create({
      id: '',
      authorUserId: user.uid,
      programId: program.id,
    });
    // Update programs to reflect newly added day of week (in the drawer-open program)
    const updated = await API.Programs.update({
      id: program.id,
      daysOfWeek: { ...program.daysOfWeek, [data.dayOfWeek]: newProgramLogTemplateId },
    });
    setPrograms(programs.map(p => (p.id === program.id ? updated : p)));
    // Update drawer state to reflect DB
    editorDrawer.setData({ ...data, templateId: newProgramLogTemplateId });
    // Return new template (id) for users to add movements to since they just
    // clicked the (add template) button
    return newProgramLogTemplateId;
  }, [editorDrawer.getData()?.templateId, programDrawer.getData()]);

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
        toast.success(`Active program set to ${program.name}`);
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
          padding: theme => theme.spacing(2),
        }}
      >
        <Stack direction="row" width="100" justifyContent="space-between" alignItems="center">
          <IconButton onClick={() => navigate(Paths.account)} color="primary">
            <NavigateBeforeRounded />
          </IconButton>
          <Stack>
            <Typography variant="overline">Program</Typography>
            <Typography variant="body2" color="textSecondary">
              Take out the guesswork: create your training or follow an existing plan
            </Typography>
          </Stack>
          <Button startIcon={<AddRounded />} onClick={addProgramDrawer.onOpen}>
            New
          </Button>
        </Stack>

        <DataStateView data={programs}>
          {programs =>
            programs.length === 0 ? (
              <Typography variant="overline" sx={{ textAlign: 'center' }}>
                Nothing yet
              </Typography>
            ) : (
              <Stack spacing={3} sx={{ padding: theme => theme.spacing(3, 1) }}>
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
                      onClick={event => {
                        programDrawer.onOpen(event, program);
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
                    </Box>
                  );
                })}
              </Stack>
            )
          }
        </DataStateView>
      </Box>

      {/** ----------------------------- DRAWERS ----------------------------- */}

      <SwipeableDrawer {...programDrawer.props()} anchor="bottom">
        <Box height="85vh" key={JSON.stringify(programDrawer.getData())}>
          <WithVariable value={programDrawer.getData()}>
            {program => {
              if (program === null) {
                return <>Nothing to show here.</>;
              }
              const isActive =
                DataState.isReady(programUser) && programUser.activeProgramId === program?.id;
              const isOwner = user.uid === program.authorUserId;
              return (
                <Stack spacing={2}>
                  <Stack>
                    <Typography
                      variant="overline"
                      sx={{ textAlign: 'center' }}
                      color="textSecondary"
                      marginBottom={-1.5}
                    >
                      Active Program:
                    </Typography>
                    <Typography variant="overline" sx={{ textAlign: 'center' }}>
                      {program.name}
                    </Typography>
                  </Stack>
                  <Stack direction="row">
                    {/** Title or Edit input with Delete button if owner */}
                    {isOwner && isActive && DataState.isReady(programs) && (
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
                            if (!window.confirm('Are you sure? This can never be undone.')) return;
                            try {
                              await API.Programs.delete(program.id);
                              setPrograms(programs.filter(p => p.id !== program.id));
                              toast.success('Deleted program.');
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }}
                        >
                          <DeleteForeverRounded fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
                  <Button
                    fullWidth
                    variant="text"
                    disabled={isActive}
                    onClick={() => {
                      const program = programDrawer.getData();
                      if (!program || !DataState.isReady(programUser)) return;
                      const { activeProgramId, activeProgramName } = programUser;
                      if (activeProgramId === program.id) return;
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
                                    toast.error('Unreachable: Template with zero movements.');
                                    return null;
                                  }
                                  return (
                                    <Typography variant="body2" fontWeight={600}>
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

                  {/**<DataStateView data={programTemplates}>
                    {programTemplates => (
                      <Stack spacing={2}>
                        {programTemplates.map(template => (
                          <Box
                            key={template.id}
                            sx={{
                              padding: theme => theme.spacing(2),
                              backgroundColor: theme => theme.palette.grey[100],
                              borderRadius: 2,
                              minHeight: '12vh',
                              ...(isActive
                                ? { border: theme => `1px solid ${theme.palette.primary.main}` }
                                : {}),
                            }}
                            onClick={event => {
                              toast.info('Unimplemented');
                            }}
                          >
                            foo
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </DataStateView>*/}
                </Stack>
              );
            }}
          </WithVariable>
        </Box>
      </SwipeableDrawer>

      <SwipeableDrawer
        {...editorDrawer.props()}
        anchor="bottom"
        onClose={async () => {
          const data = editorDrawer.getData();
          const program = programDrawer.getData();
          if (!!data && !!program) {
            const { templateId, dayOfWeek } = data;
            if (!!templateId) {
              // If no movements exist in the training template, then delete the
              // template from the schedule
              const movements = await API.ProgramMovements.getAll(where('logId', '==', templateId));
              if (movements.length === 0) {
                const [, updated] = await Promise.all([
                  API.ProgramLogTemplates.delete(templateId),
                  API.Programs.update({
                    id: program.id,
                    daysOfWeek: { ...program.daysOfWeek, [dayOfWeek]: null },
                  }),
                ]);
                if (!DataState.isReady(programs)) throw Error('Unreachable');
                setPrograms(programs.map(p => (p.id === program.id ? updated : p)));
              }
            }
          }
          editorDrawer.onClose();
        }}
      >
        <Collapse in={editorDrawer.open}>
          <Box height="75vh">
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
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="baseline"
                      sx={{ mt: -1 }}
                    >
                      <Typography variant="overline" width="100%">
                        {name}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (!window.confirm(`Delete ${name}?`)) return;
                          toast.info('Unimplemented: Delete template');
                        }}
                      >
                        <DeleteForeverRounded fontSize="small" sx={{ opacity: 0.8 }} />
                      </IconButton>
                    </Stack>
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
                  <IconButton disableRipple size="small" onClick={() => setNewProgramName('')}>
                    <Close />
                  </IconButton>
                ),
              }}
            />
          </ReactFocusLock>
          <Button
            variant="text"
            startIcon={<AddRounded />}
            size="large"
            onClick={async function createProgram() {
              if (!DataState.isReady(programs)) return;
              try {
                const created = await API.Programs.create({
                  name: newProgramName,
                  authorUserId: user.uid,
                  id: '',
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

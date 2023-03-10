import {
  AddRounded,
  Close,
  DeleteForeverRounded,
  NavigateBeforeRounded,
  VerifiedRounded,
} from '@mui/icons-material';
import {
  Box,
  Button,
  debounce,
  IconButton,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
} from '@mui/material';
import { where } from 'firebase/firestore';
import { FC, useCallback, useState } from 'react';
import ReactFocusLock from 'react-focus-lock';
import { useNavigate } from 'react-router-dom';

import { API } from '../api';
import { WithVariable } from '../components/Variable';
import { useUser } from '../context';
import { Program, ProgramUser } from '../types';
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

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const addProgramDrawer = useMaterialMenu();
  // new drawer will contain
  const editProgramDrawer = useDrawer<Program>();

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
            toast.info('Deleting hella extra program-users...');
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

  const [programTemplates, setProgramTemplates] = useDataState(async () => {
    const program = editProgramDrawer.getData();
    if (!!program && editProgramDrawer.open === true) {
      return API.Templates.getAll(where('programId', '==', program.id));
    }
    return DataState.Empty;
  }, [editProgramDrawer.open]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateActiveProgram = useCallback(
    debounce(async (program: Program) => {
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
    }, 1000),
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
              Take out the guesswork: follow an existing plan, or create your training
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
                        editProgramDrawer.onOpen(event, program);
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

      <SwipeableDrawer {...editProgramDrawer.props()} anchor="bottom">
        <Box minHeight="85vh">
          <WithVariable value={editProgramDrawer.getData()}>
            {program => {
              if (program === null) {
                return <>Nothing to show here.</>;
              }
              const isActive =
                DataState.isReady(programUser) && programUser.activeProgramId === program?.id;
              const isOwner = user.uid === program.authorUserId;
              return (
                <Stack spacing={3}>
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
                    variant="outlined"
                    disabled={isActive}
                    onClick={() => {
                      const program = editProgramDrawer.getData();
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
                  <Stack spacing={2}>
                    {(
                      [
                        program.schedule.sunday,
                        program.schedule.monday,
                        program.schedule.tuesday,
                        program.schedule.wednesday,
                        program.schedule.thursday,
                        program.schedule.friday,
                        program.schedule.saturday,
                      ] as const
                    ).map((log, index, logs) => {
                      const weekday = Object.keys(Weekdays)[index].toLowerCase();
                      console.log('weekday', weekday);
                      return (
                        <Box
                          key={weekday}
                          sx={{
                            padding: theme => theme.spacing(1, 2),
                            backgroundColor: theme => theme.palette.divider,
                            borderRadius: 2,
                          }}
                          onClick={event => {
                            toast.info('Unimplemented');
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="center">
                            <Typography width="100%">
                              {weekday.charAt(0).toUpperCase() + weekday.slice(1)}
                            </Typography>
                            {/** Rest typography or Day N and movements and joined */}
                            <Typography variant="overline" color="textSecondary">
                              Rest
                            </Typography>
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
                  schedule: {
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

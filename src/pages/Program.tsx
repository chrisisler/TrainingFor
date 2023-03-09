import { AddRounded, Close, NavigateBeforeRounded, VerifiedRounded } from '@mui/icons-material';
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
import { useUser } from '../context';
import { Program, ProgramUser } from '../types';
import { DataState, DataStateView, Paths, useDataState, useMaterialMenu, useToast } from '../util';

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const addProgramDrawer = useMaterialMenu();

  const [newProgramName, setNewProgramName] = useState('');

  // Currently only user-local programs are shown, NOT all programs ever made in the app
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
  console.log('programUser', programUser);

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
          <Typography variant="overline">Program</Typography>
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
                        backgroundColor: theme => theme.palette.grey[100],
                        borderRadius: 2,
                        minHeight: '12vh',
                        ...(isActive
                          ? { border: theme => `1px solid ${theme.palette.primary.main}` }
                          : {}),
                      }}
                      onClick={() => {
                        if (!DataState.isReady(programUser)) return;
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
                      <Stack direction="row" justifyContent="space-between">
                        <Typography
                          variant="h6"
                          sx={{ color: isActive ? 'text.primary' : 'text.secondary' }}
                          fontWeight={200}
                        >
                          {program.name}
                        </Typography>
                        {isActive && <VerifiedRounded />}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )
          }
        </DataStateView>

        {/** List of programs */}
      </Box>

      {/** ----------------------------- DRAWERS ----------------------------- */}

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

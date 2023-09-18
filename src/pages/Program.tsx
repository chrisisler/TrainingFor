import { DeleteForeverRounded, EditOutlined, PlaylistAddRounded } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Paper,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
} from '@mui/material';
import { getCountFromServer, query, where } from 'firebase/firestore';
import { FC, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { API, useStore } from '../api';
import { NotesDrawer, WithVariable } from '../components';
import { useUser } from '../context';
import { Program } from '../types';
import {
  DataState,
  DataStateView,
  Paths,
  useDataState,
  useDrawer,
  useMaterialMenu,
  useToast,
} from '../util';
import { EditorInternals } from './Editor';

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const programNoteDrawer = useMaterialMenu();
  const editorDrawer = useDrawer<{ templateId: null | string }>();

  const { programId } = useParams<{ programId: string }>();

  const ProgramsAPI = useStore(store => store.ProgramsAPI);
  const ProgramUsersAPI = useStore(store => store.ProgramUsersAPI);
  const TemplatesAPI = useStore(store => store.ProgramLogTemplatesAPI);
  const programUser = useStore(store => store.programUser);
  const templates = useStore(store => store.templates);
  const viewedProgram = useStore(store => {
    if (!DataState.isReady(store.programs)) return null;
    const found = store.programs.find(_ => _.id === programId);
    if (found) return found;
    toast.info('No Program with that ID. Redirecting...');
    navigate(Paths.home);
    throw Error('Unreachable: navigatd away');
  });

  const [newTemplateId] = useDataState(async () => {
    if (!editorDrawer.open) return DataState.Empty;
    const program = viewedProgram;
    const data = editorDrawer.getData();
    if (!data || !program) return DataState.Empty;
    if (data.templateId) return data.templateId;
    const { id: newProgramLogTemplateId } = await TemplatesAPI.create({
      authorUserId: user.uid,
      programId: program.id,
      name: '',
    });
    // Update programs to reflect newly added day of week (in the drawer-open program)
    await ProgramsAPI.update({
      id: program.id,
      templateIds: program.templateIds.concat(newProgramLogTemplateId),
    });
    // Update drawer state to reflect DB changes
    editorDrawer.setData({ ...data, templateId: newProgramLogTemplateId });
    return newProgramLogTemplateId;
  }, [editorDrawer.getData()?.templateId, viewedProgram, user.uid, ProgramsAPI]);

  const updateActiveProgram = useCallback(
    async (program: Program) => {
      if (!DataState.isReady(programUser)) {
        toast.error('Program user not found or ready.');
        return;
      }
      try {
        await ProgramUsersAPI.update({
          activeProgramName: program.name,
          activeProgramId: program.id,
          id: programUser.id,
        });
        toast.info('Updated active program.');
      } catch (err) {
        toast.error(err.message);
      }
    },
    [toast, ProgramUsersAPI, programUser]
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
        {viewedProgram?.authorUserId === user.uid && (
          <Button variant="outlined" onClick={event => programNoteDrawer.onOpen(event)}>
            Note
          </Button>
        )}

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
                <Stack spacing={1} direction="row" sx={{ justifyContent: 'center', width: '100%' }}>
                  <Typography variant="overline" color="textSecondary" lineHeight={1}>
                    {isActive ? 'Active ' : ''}Program:
                  </Typography>
                  <Typography variant="overline" lineHeight={1}>
                    {program.name}
                  </Typography>
                </Stack>
                {/** Title or Edit input with Delete button if owner */}
                {isOwner && isActive && (
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
                            await ProgramUsersAPI.update({
                              id: programUser.id,
                              activeProgramName: newName,
                            });
                            // TODO await this??
                            ProgramsAPI.update({ id: program.id, name: newName });
                            toast.info('Updated program name.');
                          } catch (err) {
                            toast.error(err.message);
                          }
                        }}
                      />
                      <IconButton
                        color="error"
                        onClick={async function deleteProgram() {
                          try {
                            // TODO
                            await Promise.all([
                              API.Programs.delete(program.id),
                              API.ProgramUsers.update({
                                id: programUser.id,
                                activeProgramId: null,
                                activeProgramName: null,
                              }),
                              API.ProgramLogTemplates.deleteMany(
                                where('programId', '==', program.id)
                              ),
                              ...[
                                program.templateIds.map(_ =>
                                  API.ProgramMovements.deleteMany(where('logId', '==', _))
                                ),
                              ],
                            ]);
                            navigate(Paths.home);
                            toast.info('Deleted program.');
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
                <Stack spacing={3}>
                  {program.templateIds.map((templateId, index) => {
                    return (
                      <Paper
                        key={templateId}
                        elevation={2}
                        sx={{
                          padding: theme => theme.spacing(2),
                        }}
                      >
                        <Stack alignItems="center" justifyContent="center" spacing={3}>
                          <DataStateView data={templates}>
                            {templates => (
                              <Typography variant="h6" whiteSpace="nowrap" color="text.secondary">
                                {templates.find(t => t.id === templateId)?.name ||
                                  `Day ${index + 1}`}
                              </Typography>
                            )}
                          </DataStateView>
                          <Stack>
                            {/**<DataStateView data={programMovementsByTemplateId}>
                                {programMovementsByTemplateId => {
                                  const movements = programMovementsByTemplateId.get(templateId);
                                  if (!movements) return null;
                                  if (movements.length === 0) return null;
                                  return (
                                    <>
                                      {movements.map(movement => (
                                        <Typography
                                          variant="body2"
                                          key={movement.id}
                                          fontWeight={600}
                                        >
                                          {movement.name}
                                        </Typography>
                                      ))}
                                    </>
                                  );
                                }}
                              </DataStateView>*/}
                          </Stack>
                          <IconButton
                            sx={{ color: theme => theme.palette.primary.main }}
                            onClick={event => {
                              editorDrawer.onOpen(event, {
                                templateId: templateId,
                              });
                            }}
                          >
                            <EditOutlined />
                          </IconButton>
                        </Stack>
                      </Paper>
                    );
                  })}

                  <Box sx={{ padding: theme => theme.spacing(1, 2) }}>
                    <Stack direction="row" alignItems="center" justifyContent="center" width="100%">
                      <Box />
                      <IconButton
                        sx={{ color: theme => theme.palette.primary.main }}
                        onClick={event => {
                          // TODO Fetches data as a side effect.
                          // Separate side effect into explicit store.action() call
                          editorDrawer.onOpen(event, { templateId: null });
                        }}
                      >
                        <PlaylistAddRounded />
                      </IconButton>
                    </Stack>
                  </Box>
                </Stack>
              </Stack>
            );
          }}
        </WithVariable>
      </Box>

      {/** ----------------------------- DRAWERS ----------------------------- */}

      <SwipeableDrawer {...programNoteDrawer} anchor="bottom">
        <Collapse in={programNoteDrawer.open}>
          {!!viewedProgram && (
            <NotesDrawer
              note={viewedProgram?.note || ''}
              onBlur={async (next: string) => {
                try {
                  await ProgramsAPI.update({ id: viewedProgram.id, note: next });
                } catch (error) {
                  toast.error(error.message);
                }
              }}
            />
          )}
        </Collapse>
      </SwipeableDrawer>

      <SwipeableDrawer
        {...editorDrawer.props()}
        anchor="bottom"
        onClose={async () => {
          const context = editorDrawer.getData();
          if (!!context && !!viewedProgram) {
            const { templateId } = context;
            if (!templateId) return;
            const { templateIds } = viewedProgram;
            // If no movements exist in this template, delete it.
            const noMovements = await getCountFromServer(
              query(API.collections.programMovements, where('logId', '==', templateId))
            ).then(_ => _.data().count === 0);
            if (noMovements) {
              await Promise.all([
                TemplatesAPI.delete(templateId),
                ProgramsAPI.update({
                  id: viewedProgram.id,
                  templateIds: templateIds.filter(id => id !== templateId),
                }),
              ]);
            } else {
              // Update viewedProgram which updates movement names display
              // setViewedProgram({
              //   ...viewedProgram,
              //   templateIds: templateIds.concat(templateId),
              // });
            }
          }
          editorDrawer.onClose();
        }}
      >
        <Collapse in={editorDrawer.open}>
          <Box height="80vh">
            <WithVariable value={editorDrawer.getData()}>
              {drawerData => {
                if (!drawerData) return null;
                const { templateId } = drawerData;
                return (
                  <Stack spacing={1}>
                    <TextField
                      sx={{ alignSelf: 'end' }}
                      placeholder="Template Name"
                      defaultValue={
                        DataState.isReady(templates) &&
                        templates.find(t => t.id === templateId)?.name
                      }
                      variant="standard"
                      onBlur={async event => {
                        if (!templateId) throw Error('Unreachable: templateId not found.');
                        try {
                          const newName = event.target.value;
                          TemplatesAPI.update({
                            id: templateId,
                            name: newName,
                          });
                        } catch (error) {
                          toast.error(error.message);
                        }
                      }}
                    />
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
    </>
  );
};

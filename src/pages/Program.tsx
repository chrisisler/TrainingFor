import {
  AddRounded,
  AutoAwesomeRounded,
  DeleteForeverRounded,
  EditOutlined,
  NoteAltOutlined,
  PersonOutline,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  InputBase,
  Paper,
  Skeleton,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
} from '@mui/material';
import { getCountFromServer, query, where } from 'firebase/firestore';
import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { API, useStore } from '../api';
import { NotesDrawer } from '../components';
import {
  DataState,
  DataStateView,
  Paths,
  dateDisplay,
  useDrawer,
  useMaterialMenu,
  useUser,
  useToast,
} from '../util';
import { EditorInternals } from './Editor';

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const programNoteDrawer = useMaterialMenu();
  const templateEditorDrawer = useDrawer<{ templateId: string }>();
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();

  const ProgramsAPI = useStore(store => store.ProgramsAPI);
  const ProgramUsersAPI = useStore(store => store.ProgramUsersAPI);
  const ProgramMovementsAPI = useStore(store => store.ProgramMovementsAPI);
  const TemplatesAPI = useStore(store => store.ProgramLogTemplatesAPI);
  const programUser = useStore(store => store.programUser);
  const templates = useStore(store => store.templates);
  const viewedProgram = useStore(store =>
    DataState.map(
      store.programs,
      programs => programs.find(_ => _.id === programId) ?? DataState.error('Program not found')
    )
  );
  const programMovementsByTemplateId = useStore(store =>
    store.useProgramMovementsByTemplateId(programId)
  );

  // Navigate home when invalid programId or viewedProgram
  useEffect(() => {
    if (!programId || DataState.isError(viewedProgram)) navigate(Paths.home);
  }, [programId, viewedProgram, navigate]);

  return (
    <>
      <Box sx={{ height: '100vh', width: '100vw', padding: theme => theme.spacing(1) }}>
        <DataStateView
          data={viewedProgram}
          loading={() => <CircularProgress variant="indeterminate" size={100} />}
        >
          {program => {
            const isActiveProgram =
              DataState.isReady(programUser) && programUser.activeProgramId === program.id;
            const userIsProgramAuthor = user.uid === program.authorUserId;

            return (
              <Stack spacing={3}>
                <Stack direction="row" spacing={1}>
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                      {dateDisplay(new Date(program.timestamp))}
                    </Typography>
                    <InputBase
                      multiline
                      maxRows={2}
                      defaultValue={program.name}
                      sx={{ fontSize: '2rem', fontWeight: 600, width: '100%' }}
                      readOnly={!(userIsProgramAuthor && isActiveProgram)}
                      disabled={!DataState.isReady(programUser)}
                      onBlur={async event => {
                        const newName = event.target.value;
                        if (newName.length < 3 || newName === program.name) {
                          toast.info('Program name must be at least 3 characters');
                          return;
                        }
                        if (!DataState.isReady(programUser)) return;
                        try {
                          await Promise.all([
                            ProgramUsersAPI.update({
                              id: programUser.id,
                              activeProgramName: newName,
                            }),
                            ProgramsAPI.update({ id: program.id, name: newName }),
                          ]);
                          toast.info('Updated program name');
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    />
                    <Box>
                      <Button
                        variant="text"
                        size="small"
                        disabled={isActiveProgram}
                        endIcon={<AutoAwesomeRounded />}
                        onClick={async () => {
                          if (
                            !DataState.isReady(viewedProgram) ||
                            !DataState.isReady(programUser)
                          ) {
                            return;
                          }
                          const { activeProgramId } = programUser;
                          if (
                            !!activeProgramId &&
                            !window.confirm(`Switch to ${viewedProgram.name}?`)
                          ) {
                            return;
                          }
                          try {
                            await ProgramUsersAPI.update({
                              id: programUser.id,
                              activeProgramName: viewedProgram.name,
                              activeProgramId: viewedProgram.id,
                            });
                            toast.info('Updated active program');
                          } catch (err) {
                            toast.error(err.message);
                          }
                        }}
                      >
                        {isActiveProgram ? 'Active Program' : 'Activate Program'}
                      </Button>
                    </Box>
                  </Stack>
                  <Stack spacing={1}>
                    <IconButton onClick={() => navigate(Paths.home)}>
                      <PersonOutline />
                    </IconButton>
                    <IconButton onClick={event => programNoteDrawer.onOpen(event)}>
                      <NoteAltOutlined />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={async function deleteProgramForever() {
                        if (!DataState.isReady(programUser)) return;
                        const inputName = window.prompt(
                          'Enter the program name to delete it forever'
                        );
                        if (inputName !== program.name) {
                          return toast.info('Exiting - program name did not match');
                        }
                        if (!window.confirm('Delete this program forever?')) return;
                        try {
                          let promises: Promise<unknown>[] = [
                            ProgramsAPI.delete(program.id),
                            // Delete templates that are children of the entry
                            TemplatesAPI.deleteMany(where('programId', '==', program.id)),
                            // Delete programmovements that are children of the templates
                            ...program.templateIds.map(id =>
                              ProgramMovementsAPI.deleteMany(where('logId', '==', id))
                            ),
                          ];
                          // Point the users active program to nothing
                          if (isActiveProgram) {
                            promises.push(
                              ProgramUsersAPI.update({
                                id: programUser.id,
                                activeProgramId: null,
                                activeProgramName: null,
                              })
                            );
                          }
                          await Promise.all(promises);
                          navigate(Paths.home);
                          toast.info('Deleted program');
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <DeleteForeverRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>

                <Stack spacing={3}>
                  {program.templateIds.map(templateId => (
                    <Paper
                      key={templateId}
                      elevation={2}
                      sx={{ padding: theme => theme.spacing(2) }}
                    >
                      <Stack alignItems="center" justifyContent="center" spacing={3}>
                        <DataStateView data={templates} loading={() => <Skeleton variant="text" />}>
                          {templates => (
                            <Typography variant="h6" whiteSpace="nowrap" color="text.secondary">
                              {templates.find(t => t.id === templateId)?.name}
                            </Typography>
                          )}
                        </DataStateView>
                        <Stack>
                          <DataStateView
                            data={programMovementsByTemplateId}
                            loading={() => (
                              <>
                                <Skeleton variant="text" />
                                <Skeleton variant="text" />
                              </>
                            )}
                          >
                            {programMovementsByTemplateId => {
                              const movements = programMovementsByTemplateId.get(templateId);
                              if (!movements) return null;
                              if (movements.length === 0) return null;
                              return (
                                <>
                                  {movements.map(movement => (
                                    <Typography variant="body2" key={movement.id} fontWeight={600}>
                                      {movement.name}
                                    </Typography>
                                  ))}
                                </>
                              );
                            }}
                          </DataStateView>
                        </Stack>
                        <IconButton
                          sx={{ color: theme => theme.palette.primary.main }}
                          onClick={event => {
                            templateEditorDrawer.onOpen(event, { templateId });
                          }}
                        >
                          <EditOutlined />
                        </IconButton>
                      </Stack>
                    </Paper>
                  ))}

                  <Box sx={{ padding: theme => theme.spacing(1, 2) }}>
                    <Stack direction="row" alignItems="center" justifyContent="center" width="100%">
                      <Box />
                      <Button
                        sx={{ color: theme => theme.palette.primary.main }}
                        startIcon={<AddRounded />}
                        variant="outlined"
                        onClick={async event => {
                          try {
                            const newTemplate = await TemplatesAPI.create({
                              authorUserId: user.uid,
                              programId: program.id,
                              name: 'Untitled',
                            });
                            const templateIds = program.templateIds.concat(newTemplate.id);
                            // Update programs to reflect newly added day
                            await ProgramsAPI.update({ id: program.id, templateIds });
                            templateEditorDrawer.onOpen(event, { templateId: newTemplate.id });
                          } catch (err) {
                            toast.error(err.message);
                          }
                        }}
                      >
                        Add A Template
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Stack>
            );
          }}
        </DataStateView>
      </Box>

      {/** ----------------------------- DRAWERS ----------------------------- */}

      <SwipeableDrawer {...programNoteDrawer} anchor="bottom">
        <Collapse in={programNoteDrawer.open}>
          {DataState.isReady(viewedProgram) && (
            <NotesDrawer
              note={viewedProgram.note || ''}
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
        {...templateEditorDrawer.props()}
        anchor="bottom"
        onClose={async () => {
          const context = templateEditorDrawer.getData();
          if (!!context && DataState.isReady(viewedProgram)) {
            const { templateId } = context;
            if (!templateId) return;
            const { templateIds } = viewedProgram;
            // If no movements exist in this template, delete it.
            const q = query(API.collections.programMovements, where('logId', '==', templateId));
            const noMovements = await getCountFromServer(q).then(_ => _.data().count === 0);
            if (noMovements) {
              await Promise.all([
                TemplatesAPI.delete(templateId),
                ProgramsAPI.update({
                  id: viewedProgram.id,
                  templateIds: templateIds.filter(id => id !== templateId),
                }),
              ]);
            } else {
              // Update template movement names display
              queryClient.invalidateQueries(ProgramMovementsAPI.queryKey);
            }
          }
          templateEditorDrawer.onClose();
        }}
      >
        <Collapse in={templateEditorDrawer.open}>
          <Box height="80vh">
            {templateEditorDrawer.getData()?.templateId && (
              <EditorDrawerView templateId={templateEditorDrawer.getData()?.templateId} />
            )}
          </Box>
        </Collapse>
      </SwipeableDrawer>
    </>
  );
};

const EditorDrawerView: FC<{ templateId?: string }> = ({ templateId }) => {
  const TemplatesAPI = useStore(store => store.ProgramLogTemplatesAPI);
  const templates = useStore(store => store.templates);

  const toast = useToast();

  if (!templateId) {
    toast.error('Unreachable: templateId not found');
    return null;
  }

  // TODO make this a prop
  const templateName =
    DataState.isReady(templates) && templates.find(t => t.id === templateId)?.name;

  return (
    <Stack spacing={1}>
      <TextField
        sx={{ alignSelf: 'start' }}
        placeholder="Template Name"
        defaultValue={templateName}
        variant="standard"
        onBlur={async event => {
          try {
            const newName = event.target.value;
            if (newName.length === 0 || newName === templateName) return;
            await TemplatesAPI.update({ id: templateId, name: newName });
          } catch (error) {
            toast.error(error.message);
          }
        }}
      />
      <Box sx={{ height: '100%', width: '100%', overflowY: 'scroll' }}>
        <EditorInternals isProgramView logId={templateId} />
      </Box>
    </Stack>
  );
};

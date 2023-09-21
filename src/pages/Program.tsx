import {
  DeleteForeverRounded,
  EditOutlined,
  NoteAltOutlined,
  PersonOutline,
  PlaylistAddRounded,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  InputBase,
  Paper,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
} from '@mui/material';
import { getCountFromServer, query, where } from 'firebase/firestore';
import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { API, useStore } from '../api';
import { NotesDrawer } from '../components';
import { useUser } from '../context';
import { DataState, DataStateView, Paths, useDrawer, useMaterialMenu, useToast } from '../util';
import { EditorInternals } from './Editor';

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const programNoteDrawer = useMaterialMenu();
  const templateEditorDrawer = useDrawer<{ templateId: string }>();
  const { programId } = useParams<{ programId: string }>();

  const ProgramsAPI = useStore(store => store.ProgramsAPI);
  const ProgramUsersAPI = useStore(store => store.ProgramUsersAPI);
  const ProgramMovementsAPI = useStore(store => store.ProgramMovementsAPI);
  const TemplatesAPI = useStore(store => store.ProgramLogTemplatesAPI);
  const programUser = useStore(store => store.programUser);
  const templates = useStore(store => store.templates);
  // TODO memoize the selector for this and programMovementsByTemplateId 
  // due to deps = [programId]
  const viewedProgram = useStore(store =>
    DataState.map(
      store.programs,
      programs => programs.find(_ => _.id === programId) ?? DataState.error('Program not found')
    )
  );
  const programMovementsByTemplateId = useStore(store =>
    store.useProgramMovementsByTemplateId(programId)
  );

  useEffect(() => {
    if (!programId) navigate(Paths.home);
    if (DataState.isError(viewedProgram)) {
      toast.info('No Program with that ID. Redirecting...');
      navigate(Paths.home);
    }
  }, [navigate, programId, toast, viewedProgram]);

  const isActiveProgram =
    DataState.isReady(programUser) &&
    DataState.isReady(viewedProgram) &&
    programUser.activeProgramId === viewedProgram?.id;
  const userIsProgramAuthor =
    DataState.isReady(viewedProgram) && user.uid === viewedProgram.authorUserId;

  return (
    <>
      <Box sx={{ height: '100vh', width: '100vw', padding: theme => theme.spacing(1) }}>
        <DataStateView data={viewedProgram}>
          {program => (
            <Stack spacing={3}>
              <Stack direction="row" spacing={1}>
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
                      toast.info('Program name must be at least 3 characters.');
                      return;
                    }
                    if (!DataState.isReady(programUser)) return;
                    try {
                      await Promise.all([
                        ProgramUsersAPI.update({ id: programUser.id, activeProgramName: newName }),
                        ProgramsAPI.update({ id: program.id, name: newName }),
                      ]);
                      toast.info('Updated program name.');
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                />
                <Stack spacing={1}>
                  <IconButton onClick={() => navigate(Paths.home)}>
                    <PersonOutline />
                  </IconButton>
                  <IconButton onClick={event => programNoteDrawer.onOpen(event)}>
                    <NoteAltOutlined />
                  </IconButton>
                  <IconButton
                    color="error"
                    disabled={!DataState.isReady(programUser)}
                    onClick={async function deleteProgram() {
                      if (!DataState.isReady(programUser)) return;
                      if (!window.confirm('Permanently delete this program forever?')) return;
                      try {
                        // Deleting a Program consists of...
                        await Promise.all([
                          //1. Delete the entry
                          ProgramsAPI.delete(program.id),
                          //2. Point the users active program to nothing
                          ProgramUsersAPI.update({
                            id: programUser.id,
                            activeProgramId: null,
                            activeProgramName: null,
                          }),
                          //3. Delete templates that are children of the entry
                          TemplatesAPI.deleteMany(where('programId', '==', program.id)),
                          //4. Delete programmovements that are children of the templates
                          ...[
                            program.templateIds.map(id =>
                              ProgramMovementsAPI.deleteMany(where('logId', '==', id))
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
              {!isActiveProgram && (
                <Button
                  fullWidth
                  variant="text"
                  disabled={isActiveProgram}
                  onClick={async () => {
                    if (!DataState.isReady(viewedProgram) || !DataState.isReady(programUser)) {
                      return;
                    }
                    const { activeProgramId } = programUser;
                    if (!!activeProgramId && !window.confirm(`Switch to ${viewedProgram.name}?`)) {
                      return;
                    }
                    try {
                      await ProgramUsersAPI.update({
                        id: programUser.id,
                        activeProgramName: viewedProgram.name,
                        activeProgramId: viewedProgram.id,
                      });
                      toast.info('Updated active program.');
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                >
                  Make active program
                </Button>
              )}
              <Stack spacing={3}>
                {program.templateIds.map((templateId, index) => (
                  <Paper key={templateId} elevation={2} sx={{ padding: theme => theme.spacing(2) }}>
                    <Stack alignItems="center" justifyContent="center" spacing={3}>
                      <DataStateView data={templates}>
                        {templates => (
                          <Typography variant="h6" whiteSpace="nowrap" color="text.secondary">
                            {templates.find(t => t.id === templateId)?.name || `Day ${index + 1}`}
                          </Typography>
                        )}
                      </DataStateView>
                      <Stack>
                        <DataStateView data={programMovementsByTemplateId}>
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
                    <IconButton
                      sx={{ color: theme => theme.palette.primary.main }}
                      onClick={async event => {
                        try {
                          const newTemplate = await TemplatesAPI.create({
                            authorUserId: user.uid,
                            programId: program.id,
                            name: '',
                          });
                          // Update programs to reflect newly added day
                          await ProgramsAPI.update({
                            id: program.id,
                            templateIds: program.templateIds.concat(newTemplate.id),
                          });
                          templateEditorDrawer.onOpen(event, { templateId: newTemplate.id });
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <PlaylistAddRounded />
                    </IconButton>
                  </Stack>
                </Box>
              </Stack>
            </Stack>
          )}
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
        sx={{ alignSelf: 'end' }}
        placeholder="Template Name"
        defaultValue={templateName}
        variant="standard"
        onBlur={async event => {
          try {
            const newName = event.target.value;
            if (newName.length < 3 || newName === templateName) {
              toast.info('Template name must be at least 3 characters.');
              return;
            }
            await TemplatesAPI.update({ id: templateId, name: newName });
            toast.info('Updated template name.');
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

import {
  Add,
  AutoAwesome,
  DeleteForeverOutlined,
  EditOutlined,
  NoteAltOutlined,
  Notes,
} from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Collapse,
  darken,
  IconButton,
  InputBase,
  Paper,
  Skeleton,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { getCountFromServer, query, where } from 'firebase/firestore';
import { FC, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
import { EditorInternals, LeftsidePanel } from './Editor';

export const Programs: FC = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const programNoteDrawer = useMaterialMenu();
  const accountDrawer = useMaterialMenu();
  const templateEditorDrawer = useDrawer<{ templateId: string }>();
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();

  const [pinned, setPinned] = useState(false);

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

  const title = DataState.isReady(viewedProgram) ? viewedProgram.name : 'Program';

  // Navigate home when invalid programId or viewedProgram
  useEffect(() => {
    if (!programId || DataState.isError(viewedProgram)) navigate(Paths.home);
  }, [programId, viewedProgram, navigate]);

  const onActivateProgram = useCallback(async () => {
    if (!DataState.isReady(viewedProgram) || !DataState.isReady(programUser)) {
      return;
    }

    if (programUser.activeProgramId && !window.confirm(`Switch to ${viewedProgram.name}?`)) {
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
  }, [viewedProgram, programUser]);

  const onDeleteTemplate = useCallback(async () => {
    if (!DataState.isReady(programUser) || !DataState.isReady(viewedProgram)) {
      return;
    }

    const inputName = window.prompt('Enter the program name to delete it forever');
    if (inputName !== viewedProgram.name) {
      toast.info('Exiting - program name did not match');
      return;
    }

    if (!window.confirm('Delete this program forever?')) {
      return;
    }

    try {
      let promises: Promise<unknown>[] = [
        ProgramsAPI.delete(viewedProgram.id),

        // Delete templates that are children of the entry
        TemplatesAPI.deleteMany(where('programId', '==', viewedProgram.id)),

        // Delete programmovements that are children of the templates
        ...viewedProgram.templateIds.map(id =>
          ProgramMovementsAPI.deleteMany(where('logId', '==', id))
        ),
      ];

      if (programUser.activeProgramId === viewedProgram.id) {
        // Point the users active program to nothing
        const promise = ProgramUsersAPI.update({
          id: programUser.id,
          activeProgramId: null,
          activeProgramName: null,
        });
        promises.push(promise);
      }

      await Promise.all(promises);

      navigate(Paths.home);
      toast.info('Deleted program');
    } catch (err) {
      toast.error(err.message);
    }
  }, [programUser, viewedProgram]);

  const updateProgramName = useCallback(
    async event => {
      if (!DataState.isReady(viewedProgram)) {
        return;
      }

      const newName = event.target.value;
      if (newName.length < 3 || newName === viewedProgram.name) {
        toast.info('Program name must be at least 3 characters');
        return;
      }

      if (!DataState.isReady(programUser)) {
        return;
      }

      try {
        await Promise.all([
          ProgramUsersAPI.update({
            id: programUser.id,
            activeProgramName: newName,
          }),
          ProgramsAPI.update({ id: viewedProgram.id, name: newName }),
        ]);

        toast.info('Updated program name');
      } catch (err) {
        toast.error(err.message);
      }
    },
    [viewedProgram, programUser]
  );

  const createTemplate = useCallback(
    async event => {
      if (!DataState.isReady(viewedProgram)) {
        return;
      }

      try {
        const newTemplate = await TemplatesAPI.create({
          authorUserId: user.uid,
          programId: viewedProgram.id,
          name: 'Untitled',
        });

        // Update programs to reflect newly added day
        await ProgramsAPI.update({
          id: viewedProgram.id,
          templateIds: viewedProgram.templateIds.concat(newTemplate.id),
        });

        templateEditorDrawer.onOpen(event, { templateId: newTemplate.id });
      } catch (err) {
        toast.error(err.message);
      }
    },
    [viewedProgram, user]
  );

  return (
    <>
      <Box
        sx={{
          height: '100vh',
          padding: theme => theme.spacing(1),
          width: '100%',
          margin: '0 auto',
          maxWidth: '708px',
        }}
      >
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
                <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                  {dateDisplay(new Date(program.timestamp))}
                </Typography>

                <InputBase
                  multiline
                  maxRows={2}
                  defaultValue={program.name}
                  sx={{
                    fontSize: '2.5rem',
                    letterSpacing: -1.0,
                    fontWeight: 800,
                    width: '100%',
                    color: theme => theme.palette.text.primary,
                  }}
                  readOnly={!(userIsProgramAuthor && isActiveProgram)}
                  disabled={!DataState.isReady(programUser)}
                  onBlur={updateProgramName}
                />

                <Stack direction="row" spacing={2}>
                  <PanelBtn
                    icon={<AutoAwesome />}
                    onClick={onActivateProgram}
                    text={isActiveProgram ? 'Active Program' : 'Activate Program'}
                    disabled={isActiveProgram}
                  />

                  <PanelBtn
                    icon={<Add />}
                    onClick={createTemplate}
                    text="Add a template"
                    disabled={!DataState.isReady(viewedProgram)}
                  />
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
                </Stack>
              </Stack>
            );
          }}
        </DataStateView>
      </Box>

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
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton
            sx={{ color: theme => theme.palette.text.secondary }}
            onClick={event => accountDrawer.onOpen(event)}
          >
            <Notes />
          </IconButton>

          <Typography variant="body2">
            {DataState.isReady(viewedProgram) && viewedProgram.name}
          </Typography>
        </Stack>

        <Stack spacing={1} direction="row">
          <IconButton onClick={event => programNoteDrawer.onOpen(event)}>
            <NoteAltOutlined />
          </IconButton>

          <IconButton
            sx={{ color: theme => theme.palette.text.secondary }}
            onClick={onDeleteTemplate}
          >
            <DeleteForeverOutlined />
          </IconButton>
        </Stack>
      </Stack>

      {/** ----------------------------- DRAWERS ----------------------------- */}
      <SwipeableDrawer
        {...accountDrawer}
        anchor="left"
        // hideBackdrop={pinned}
        // confines screen-wide invisible element to drawer
        // sx={{ zIndex: 101, width: '240px' }}
        // PaperProps={{
        //   onMouseLeave: pinned ? undefined : accountDrawer.onClose,
        //   sx: {
        //     padding: theme => theme.spacing(1, 1.5, 2, 1.5),
        //     boxShadow: 'none',
        //     backgroundColor: theme =>
        //       darken(theme.palette.background.default, prefersDark ? 1.0 : 0.03),
        //   },
        // }}
      >
        <LeftsidePanel
          pinned={pinned}
          setPinned={setPinned}
          onClose={accountDrawer.onClose}
          title={title}
        />
      </SwipeableDrawer>

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

const PanelBtn: FC<{
  onClick(event: React.MouseEvent): Promise<void>;
  text: string;
  icon: React.ReactNode;
  disabled?: boolean
}> = ({ onClick, text, icon, disabled }) => {
  const prefersDark = useMediaQuery('@media (prefers-color-scheme: dark)');

  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        backgroundColor: theme => darken(theme.palette.action.hover, prefersDark ? 0.2 : 0.02),
        width: '50%',
        borderRadius: 2,
        padding: 2,
      }}
    >
      <IconButton
        onClick={onClick}
        disabled={disabled}
        sx={{
          backgroundColor: theme => theme.palette.background.default,
          borderRadius: 3,
        }}
      >
        {icon}
      </IconButton>

      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {text}
      </Typography>
    </Box>
  );
};

const EditorDrawerView: FC<{ templateId?: string }> = ({ templateId }) => {
  const TemplatesAPI = useStore(store => store.ProgramLogTemplatesAPI);
  const templates = useStore(store => store.templates);

  const toast = useToast();

  if (!templateId) {
    toast.error('No template found');
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
            if (newName.length === 0 || newName === templateName) {
              return;
            }

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

import {
  Add,
  AutoAwesomeOutlined,
  DeleteForeverOutlined,
  EditOutlined,
  NoteAltOutlined,
  Notes,
} from '@mui/icons-material';
import {
  Backdrop,
  Box,
  CircularProgress,
  Collapse,
  darken,
  Divider,
  IconButton,
  InputBase,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { getCountFromServer, query, where } from 'firebase/firestore';
import { FC, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { API, useStore } from '../api';
import { NotesDrawer, ShareBtn, AccountPanel } from '../components';
import {
  DataState,
  DataStateView,
  Paths,
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
  const accountDrawer = useMaterialMenu();
  const templateEditorDrawer = useDrawer<{ templateId: string }>();
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();
  const isMutating = useIsMutating() > 0;

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
    if (!programId || DataState.isError(viewedProgram)) {
      navigate(Paths.editor(''));
    }
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
  }, [viewedProgram, programUser, toast, ProgramUsersAPI]);

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

      navigate(Paths.editor(''));
      toast.info('Deleted program');
    } catch (err) {
      toast.error(err.message);
    }
  }, [
    programUser,
    viewedProgram,
    ProgramsAPI,
    TemplatesAPI,
    ProgramMovementsAPI,
    navigate,
    toast,
    ProgramUsersAPI,
  ]);

  const updateProgramName = useCallback(
    async event => {
      if (!DataState.isReady(viewedProgram) || !DataState.isReady(programUser)) {
        return;
      }

      const newName = event.target.value;
      if (newName === viewedProgram.name) {
        if (newName.length < 3) {
          toast.info('Program name must be at least 3 characters');
        }
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
    [viewedProgram, programUser, ProgramsAPI, ProgramUsersAPI, toast]
  );

  const createTemplate = useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      if (!DataState.isReady(viewedProgram)) {
        return;
      }

      const { currentTarget } = event;

      try {
        const newTemplate = await TemplatesAPI.create({
          authorUserId: user.uid,
          programId: viewedProgram.id,
          name: 'Untitled',
        });

        await ProgramsAPI.update({
          id: viewedProgram.id,
          templateIds: viewedProgram.templateIds.concat(newTemplate.id),
        }).catch(() => {
          // roll it back: failed to update program to include template
          // avoid dangling template not linked to program
          TemplatesAPI.delete(newTemplate.id);
        });

        templateEditorDrawer.onOpen(
          // workaround to make this `onOpen` call work/do what it's supposed to do
          { currentTarget } as typeof event,
          { templateId: newTemplate.id }
        );
      } catch (err) {
        toast.error(err.message);
      }
    },
    [viewedProgram, user, TemplatesAPI, ProgramsAPI, templateEditorDrawer, toast]
  );

  return (
    <>
      <Backdrop open={isMutating} sx={{ zIndex: theme => theme.zIndex.drawer + 10 }}>
        <Box sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CircularProgress size={64} />
        </Box>
      </Backdrop >

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
          data={DataState.all(viewedProgram, programMovementsByTemplateId)}
          loading={() => <CircularProgress variant="indeterminate" size={100} />}
        >
          {([program, programMovementsByTemplateId]) => {
            const isActiveProgram =
              DataState.isReady(programUser) && programUser.activeProgramId === program.id;
            const userIsProgramAuthor = user.uid === program.authorUserId;

            return (
              <Stack spacing={2} paddingTop="3rem">
                <InputBase
                  multiline
                  maxRows={2}
                  key={program.name}
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

                <Stack direction="row" flexWrap="wrap">
                  <PanelBtn
                    icon={<AutoAwesomeOutlined />}
                    onClick={onActivateProgram}
                    text={isActiveProgram ? 'Program currently selected' : 'Activate Program'}
                    disabled={isActiveProgram}
                  />

                  <PanelBtn
                    icon={<Add />}
                    onClick={createTemplate}
                    text="Add training template"
                    disabled={!DataState.isReady(viewedProgram)}
                  />
                </Stack>

                <Divider />

                <Stack direction="row" flexWrap="wrap">
                  {program.templateIds.map(templateId => {
                    const name =
                      (DataState.isReady(templates) &&
                        templates.find(t => t.id === templateId)?.name) ||
                      '';

                    const subtext = programMovementsByTemplateId
                      .get(templateId)
                      ?.map(_ => _.name)
                      ?.join(', ');

                    return (
                      <PanelBtn
                        key={templateId}
                        icon={<EditOutlined />}
                        onClick={async event => templateEditorDrawer.onOpen(event, { templateId })}
                        text={name}
                        subtext={subtext}
                      />
                    );
                  })}
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
          // zIndex: 100,
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

          <Typography variant="body2">Program</Typography>
        </Stack>

        <Stack direction="row">
          <ShareBtn />

          <IconButton onClick={event => programNoteDrawer.onOpen(event)}>
            <NoteAltOutlined sx={{ color: theme => theme.palette.text.secondary }} />
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
      <SwipeableDrawer {...accountDrawer} anchor="left">
        <AccountPanel
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
        disableBackdropTransition
        onClose={async () => {
          const context = templateEditorDrawer.getData();
          if (!!context && DataState.isReady(viewedProgram)) {
            const { templateId } = context;
            if (!templateId) {
              return;
            }

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

              toast.info("Removed empty template");
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
  onClick(event: React.MouseEvent<HTMLElement>): Promise<void>;
  text: string;
  subtext?: string;
  icon: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, text, icon, disabled, subtext }) => {
  const prefersDark = useMediaQuery('@media (prefers-color-scheme: dark)');

  return (
    <Stack
      spacing={5}
      onClick={disabled ? undefined : onClick}
      sx={{
        backgroundColor: theme => darken(theme.palette.action.hover, prefersDark ? 0.16 : 0.02),
        width: '46%',
        margin: 0.5,
        borderRadius: 3,
        padding: 2,
        cursor: 'pointer',
        border: '1px solid transparent',

        ':hover': {
          border: theme => `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <Box>
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
      </Box>

      <Typography fontWeight={600} color={subtext ? 'text.primary' : 'text.secondary'}>
        {text}
      </Typography>

      {subtext && (
        <Typography variant="body2" color="text.secondary">
          {subtext}
        </Typography>
      )}
    </Stack>
  );
};

const EditorDrawerView: FC<{ templateId?: string }> = ({ templateId }) => {
  const TemplatesAPI = useStore(store => store.ProgramLogTemplatesAPI);
  const templates = useStore(store => store.templates);
  const programUser = useStore(store => store.programUser);

  const toast = useToast();
  const { programId } = useParams<{ programId: string }>();

  if (!templateId) {
    toast.error('No template found');
    return null;
  }

  // TODO make this a prop
  const templateName =
    DataState.isReady(templates) && templates.find(t => t.id === templateId)?.name;

  const readOnly = DataState.isReady(programUser) && programUser.activeProgramId !== programId;

  const updateTemplateName = async (event: React.FocusEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName.length === 0 || newName === templateName) {
      return;
    }

    try {
      await TemplatesAPI.update({ id: templateId, name: newName });
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Stack spacing={1}>
      <TextField
        sx={{ alignSelf: 'start' }}
        placeholder="Template Name"
        disabled={readOnly}
        defaultValue={templateName}
        variant="standard"
        onBlur={updateTemplateName}
      />
      <Box sx={{ height: '100%', width: '100%', overflowY: 'scroll' }}>
        <EditorInternals isProgramView logId={templateId} readOnly={readOnly} />
      </Box>
    </Stack>
  );
};

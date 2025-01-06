import { uuidv4 } from '@firebase/util';
import {
  AddRounded,
  AppRegistrationRounded,
  ChevronRight,
  DoubleArrow,
  NoteAltOutlined,
  PersonOutline,
  PlaylistAdd,
  ViewSidebarRounded,
} from '@mui/icons-material';
import {
  Button,
  ButtonBase,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { where } from 'firebase/firestore';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { API, useStore } from '../api';
import { Movement, TrainingLog } from '../types';
import {
  DataState,
  DataStateView,
  dateDisplay,
  Paths,
  SORTED_WEEKDAYS,
  useToast,
  useUser,
} from '../util';

/**
 * @usage
 * const [pinned, setPinned] = useState(false);
 * const menu = useMaterialMenu(); // or useDrawer()
 * return (
 *   <div onClick={menu.onOpen}>...</div>
 *   <SwipeableDrawer {...menu} anchor="left">
 *     <AccountPanel pinned={pinned} setPinned={setPinned} onClose={menu.onClose} />
 *   </SwipeableDrawer>
 * );
 */
export const AccountPanel: FC<{
  title: string;
  logId?: string;
  pinned: boolean;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
}> = ({ title, pinned, setPinned, logId, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const toast = useToast();
  const user = useUser();

  const SavedMovementsAPI = useStore(store => store.SavedMovementsAPI);
  const MovementsAPI = useStore(store => store.MovementsAPI);
  const ProgramsAPI = useStore(store => store.ProgramsAPI);
  const TrainingLogsAPI = useStore(store => store.TrainingLogsAPI);
  const logs = useStore(store => store.logs);
  const sortedPrograms = useStore(store =>
    // List of programs with active program first
    DataState.map(store.programs, _programs => {
      const active = store.activeProgram;
      if (DataState.isReady(active)) {
        const first = _programs.find(p => p.id === active.id);
        if (first) return [first, ..._programs.filter(_ => _.id !== active.id)];
      }
      return _programs;
    })
  );
  const activeProgram = useStore(store => store.activeProgram);
  const templates = useStore(store => store.templates);

  const stickyable = logId !== undefined;

  const addTrainingProgram = useCallback(async () => {
    if (!window.confirm('Create a new training program?')) {
      return;
    }

    try {
      const created = await ProgramsAPI.create({
        name: 'Untitled Program',
        authorUserId: user.uid,
        timestamp: Date.now(),
        note: '',
        templateIds: [],
      });

      navigate(Paths.program(created.id, created.name));
      if (!pinned) onClose();
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast, ProgramsAPI, user.uid, pinned, onClose, navigate])

  const createTrainingLog = async ({ fromTemplateId }: { fromTemplateId: string | null }) => {
    if (!window.confirm('Begin programmed training?')) {
      return;
    }

    try {
      const programId = !!fromTemplateId && DataState.isReady(activeProgram) && activeProgram.id;
      const newTrainingLog = await TrainingLogsAPI.create({
        timestamp: Date.now(),
        authorUserId: user.uid,
        bodyweight: 0,
        isFinished: false,
        note: '',
        programId: programId || null,
        programLogTemplateId: fromTemplateId || null,
      });

      // Copy over movements from the program log template to the log
      const logIsCreatedFromProgramTemplate = !!fromTemplateId;
      if (logIsCreatedFromProgramTemplate) {
        const programMovements = await API.ProgramMovements.getAll(
          where('logId', '==', fromTemplateId)
        );

        const logMovements: Movement[] = programMovements.map(movement => ({
          ...movement,
          logId: newTrainingLog.id,
          sets: movement.sets.map(s => ({ ...s, uuid: uuidv4() })),
          timestamp: Date.now(),
        }));
        await Promise.all([
          // Create movements in the new log
          MovementsAPI.createMany(logMovements),
          // Update lastSeen property for each movement's savedMovement parent
          logMovements.map(_ =>
            SavedMovementsAPI.update({ id: _.savedMovementId, lastSeen: _.timestamp })
          ),
        ]);
      }

      navigate(Paths.editor(newTrainingLog.id));

      if (!pinned) onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Stack spacing={3} sx={{ width: isMobile ? '78vw' : '240px' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton
          sx={{ color: theme => theme.palette.text.secondary }}
          disabled={isMobile || stickyable === false}
          onClick={() => {
            if (isMobile) return;

            setPinned(bool => !bool);
          }}
        >
          {pinned ? <ViewSidebarRounded sx={{ transform: 'rotate(180deg)' }} /> : <DoubleArrow />}
        </IconButton>

        <Typography variant="body2">{title}</Typography>
      </Stack>

      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Button
          fullWidth
          variant="text"
          startIcon={<PersonOutline />}
          onClick={() => {
            navigate(Paths.editor(''));
          }}
          sx={{
            color: theme => theme.palette.text.secondary,
            fontWeight: 600,
            justifyContent: 'flex-start',
          }}
        >
          {user.displayName}
        </Button>
      </Stack>

      <Button
        onClick={async () => {
          try {
            const created = await TrainingLogsAPI.create({
              timestamp: Date.now(),
              authorUserId: user.uid,
              bodyweight: 0,
              isFinished: false,
              note: '',
              programId: null,
              programLogTemplateId: null,
            });

            navigate(Paths.editor(created.id, TrainingLog.title(created)));

            if (!pinned) onClose();
          } catch (err) {
            toast.error(err.message);
          }
        }}
        sx={{
          color: theme => theme.palette.text.primary,
          fontWeight: 600,
          justifyContent: 'flex-start',
        }}
        startIcon={<NoteAltOutlined />}
        endIcon={<AddRounded fontSize="small" sx={{ color: theme => theme.palette.divider }} />}
      >
        Add training log
      </Button>

      <DataStateView
        data={logs}
        loading={() => (
          <Stack spacing={2}>
            <Skeleton variant="rectangular" width="40%" />
            <Skeleton variant="rectangular" width="80%" />
            <Skeleton variant="rectangular" width="95%" />
            <Skeleton variant="rectangular" width="95%" />
            <Skeleton variant="rectangular" width="80%" />
            <Skeleton variant="rectangular" width="95%" />
            <Skeleton variant="rectangular" width="95%" />
          </Stack>
        )}
      >
        {logs => (
          <Stack>
            <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom>
              Training Logs
            </Typography>

            <Stack sx={{ maxHeight: '35vh', overflowY: 'scroll' }}>
              {logs.slice(0, 20).map(log => {
                const date = new Date(log.timestamp);

                return (
                  <PanelRow
                    key={log.id}
                    highlighted={logId === log.id}
                    onClick={() => {
                      if (!pinned) onClose();
                      navigate(Paths.editor(log.id, TrainingLog.title(log)));
                    }}
                    text={dateDisplay(date)}
                    subtext={
                      <>
                        <strong>{SORTED_WEEKDAYS[date.getDay()]} </strong>

                        {formatDistanceToNowStrict(date, {
                          addSuffix: true,
                        })
                          .replace(/ (\w)\w+ /i, '$1 ')
                          .replace(' ago', '')}
                      </>
                    }
                  />
                );
              })}
            </Stack>
          </Stack>
        )}
      </DataStateView>

      {DataState.isReady(activeProgram) && DataState.isReady(templates) && activeProgram.templateIds.length && (
        <Stack>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Current Program
          </Typography>

          {activeProgram.templateIds.map(templateId => (
            <Button
              key={templateId}
              onClick={() => createTrainingLog({ fromTemplateId: templateId })}
              startIcon={<AppRegistrationRounded fontSize={isMobile ? "medium" : "small"} />}
              endIcon={<AddRounded fontSize={isMobile ? "medium" : "small"} sx={{ color: theme => theme.palette.divider }} />}
              sx={{
                color: theme => theme.palette.text.secondary,
                fontWeight: 600,
                justifyContent: 'flex-start',
              }}
            >
              {templates.find(t => t.id === templateId)!.name}
            </Button>
          ))}
        </Stack>
      )}

      <DataStateView data={sortedPrograms} loading={() => null}>
        {sortedPrograms => (
          <Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="end">
              <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom>
                Training Programs
              </Typography>

              <IconButton
                onClick={addTrainingProgram}
                sx={{
                  color: theme => theme.palette.text.secondary,
                  fontWeight: 600,
                }}>
                <PlaylistAdd fontSize={isMobile ? "medium" : "small"} />
              </IconButton>
            </Stack>

            <Stack sx={{ maxHeight: '20vh', overflowY: 'scroll' }}>
              {sortedPrograms.map(program => (
                <PanelRow
                  key={program.id}
                  // highlighted={DataState.isReady(activeProgram) && program.id === activeProgram.id}
                  onClick={() => {
                    if (!pinned) onClose();
                    navigate(Paths.program(program.id, program.name));
                  }}
                  text={program.name}
                />
              ))}
            </Stack>
          </Stack>
        )}
      </DataStateView>
    </Stack>
  );
};

const PanelRow: FC<{
  subtext?: React.ReactNode;
  text: string;
  highlighted?: boolean;
  onClick: () => void;
}> = ({ subtext, text, highlighted = false, onClick }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        padding: isMobile ? '0.66rem' : '0.33rem',
        paddingLeft: 0,
        cursor: 'pointer',
        borderRadius: 1,
        ':hover': {
          backgroundColor: theme => theme.palette.action.hover,
        },

        ...(highlighted && {
          backgroundColor: theme => theme.palette.action.hover,
        }),
        ...(isMobile && {
          borderBottom: theme => `1px solid ${theme.palette.divider}`,
        }),
        // borderBottom: theme => `1px solid ${theme.palette.divider}`
        transition: 'background-color 100ms ease-in-out',
      }}
      onClick={onClick}
      justifyContent="space-between"
      alignItems="center"
    >
      <ButtonBase
        sx={{
          color: theme => (highlighted ? theme.palette.text.primary : theme.palette.text.secondary),
          fontSize: '0.9rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
        onClick={onClick}
      >
        <ChevronRight sx={{ color: theme => theme.palette.divider }} />

        {text}
      </ButtonBase>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          color: theme => (highlighted ? theme.palette.text.primary : theme.palette.text.secondary),
        }}
      >
        {subtext ?? null}
      </Typography>
    </Stack>
  );
};

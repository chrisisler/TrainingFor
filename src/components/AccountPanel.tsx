import {
  AddRounded,
  ChevronRight,
  DoubleArrow,
  ExpandMoreRounded,
  NoteAltOutlined,
  Person,
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
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { useStore } from '../api';
import { TrainingLog } from '../types';
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
 * const menu = useMaterialMenu();
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

  const ProgramsAPI = useStore(store => store.ProgramsAPI);
  const logs = useStore(store => store.logs);
  const TrainingLogsAPI = useStore(store => store.TrainingLogsAPI);
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
  // const activeProgram = useStore(store => store.activeProgram);

  const stickyable = logId !== undefined;

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

        {title ? <Typography variant="body2">{title}</Typography> : <span />}
      </Stack>

      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Button
          fullWidth
          variant="text"
          startIcon={<Person />}
          endIcon={<ExpandMoreRounded sx={{ color: theme => theme.palette.text.secondary }} />}
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
      >
        Add training log
      </Button>

      <DataStateView data={sortedPrograms} loading={() => null}>
        {sortedPrograms => (
          <Stack>
            <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom>
              Training Programs
            </Typography>

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

      <Button
        onClick={async () => {
          if (!window.confirm('Create new training program?')) {
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
        }}
        sx={{
          color: theme => theme.palette.text.secondary,
          fontWeight: 600,
          justifyContent: 'flex-start',
        }}
        startIcon={<PlaylistAdd />}
      >
        New training program
      </Button>
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

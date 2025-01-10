import { AccessAlarmRounded, ArrowDropDownRounded, ArrowDropUpRounded } from '@mui/icons-material';
import {
  Button,
  IconButton,
  Menu,
  Typography,
  useMediaQuery,
  useTheme,
  Stack,
  Badge,
} from '@mui/material';
import { FC, useEffect, useState } from 'react';

import { useDrawer } from '../util';

export const Timer: FC = () => {
  const timerMenu = useDrawer();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [pastTimers, setPastTimers] = useState<Record<string, number>[]>(
    JSON.parse(localStorage.getItem('timers') || '[]')
  );
  const [readyBadge, setReadyBadge] = useState(false);

  const timeMMSS =
    `${(secondsLeft / 60) | 0}`.padStart(2, '0') + ':' + `${secondsLeft % 60 | 0}`.padStart(2, '0');

  useEffect(() => {
    if (!started) {
      return;
    }

    const t = setTimeout(() => {
      if (secondsLeft === 0) {
        setStarted(false);
        setReadyBadge(true);
        return;
      }
      setSecondsLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(t);
  }, [started, seconds, minutes, secondsLeft]);

  const startAndSave = (timer?: { minutes: number; seconds: number }) => {
    setStarted(state => !state);
    // setReadyBadge(false);

    const sl = timer ? timer.minutes * 60 + timer.seconds : minutes * 60 + seconds;
    setSecondsLeft(sl);

    if (started) {
      return;
    }

    timerMenu.onClose();
    const timerEntry = { minutes, seconds, secondsLeft: sl };

    const pastTimers = localStorage.getItem('timers');
    if (pastTimers) {
      const parsed: Record<string, number>[] = JSON.parse(pastTimers);
      if (parsed.find(_ => _?.secondsLeft === sl)) {
        return;
      }

      if (parsed.length >= 2) {
        parsed.shift();
      }

      parsed.push(timerEntry);
      localStorage.setItem('timers', JSON.stringify(parsed));

      setPastTimers(parsed);
    } else {
      localStorage.setItem('timers', JSON.stringify([timerEntry]));

      setPastTimers([timerEntry]);
    }
  };

  return (
    <>
      <Stack direction="row" alignItems="center">
        {started && (
          <Typography variant="body2" fontWeight={600} ml={1}>
            {timeMMSS}
          </Typography>
        )}

        <IconButton onClick={event => timerMenu.onOpen(event, undefined)}>
          <Badge
            badgeContent={'Go!'}
            invisible={started || !readyBadge || pastTimers.length === 0}
            color="primary"
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <AccessAlarmRounded
              fontSize={isMobile ? 'medium' : 'small'}
              sx={{ color: 'text.secondary' }}
            />
          </Badge>
        </IconButton>
      </Stack>

      <Menu
        open={timerMenu.open}
        anchorEl={timerMenu.anchorEl}
        onClose={timerMenu.onClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Stack spacing={2} sx={{ padding: theme => theme.spacing(1, 4), outline: 'none' }}>
          <Stack direction="row" spacing={1}>
            <Stack spacing={1}>
              <IconButton
                sx={{ border: theme => `1px solid ${theme.palette.divider}` }}
                onClick={() => setMinutes(minutes + 1)}
                disabled={minutes >= 30}
              >
                <ArrowDropUpRounded sx={{ fontSize: '4rem' }} />
              </IconButton>

              <Stack direction="row" alignItems="baseline" justifyContent="center">
                <input
                  type="tel"
                  min={0}
                  max={30}
                  name="minutes"
                  value={minutes}
                  style={{
                    color: theme.palette.text.primary,
                    backgroundColor: 'transparent',
                    width: '40px',
                    outline: 'none',
                    border: 0,
                    textAlign: 'right',
                    padding: theme.spacing(1),
                    fontWeight: 400,
                    fontSize: '2.0rem',
                    letterSpacing: 0.5,
                  }}
                  onFocus={event => {
                    event.currentTarget.select();
                  }}
                  onChange={event => {
                    if (Number.isNaN(event.target.value)) {
                      return;
                    }

                    setMinutes(Number(event.target.value));
                  }}
                />

                <Typography color="text.secondary" fontWeight={600}>
                  m
                </Typography>
              </Stack>

              <IconButton
                sx={{ border: theme => `1px solid ${theme.palette.divider}` }}
                onClick={() => setMinutes(minutes - 1)}
                disabled={minutes === 0}
              >
                <ArrowDropDownRounded sx={{ fontSize: '4rem' }} />
              </IconButton>
            </Stack>

            <Stack spacing={1}>
              <IconButton
                sx={{ border: theme => `1px solid ${theme.palette.divider}` }}
                onClick={() => setSeconds(seconds + 15)}
                disabled={seconds >= 45}
              >
                <ArrowDropUpRounded sx={{ fontSize: '4rem' }} />
              </IconButton>

              <Stack direction="row" alignItems="baseline" justifyContent="center">
                <input
                  type="tel"
                  min={0}
                  max={59}
                  name="seconds"
                  value={seconds}
                  style={{
                    color: theme.palette.text.primary,
                    backgroundColor: 'transparent',
                    width: '40px',
                    border: 0,
                    outline: 'none',
                    textAlign: 'right',
                    padding: theme.spacing(1),
                    fontWeight: 400,
                    fontSize: '2.0rem',
                    letterSpacing: 0.5,
                  }}
                  onFocus={event => {
                    event.currentTarget.select();
                  }}
                  onChange={event => {
                    if (Number.isNaN(event.target.value)) {
                      return;
                    }

                    let s = Number(event.target.value);
                    if (s > 59) {
                      s = 59;
                      return;
                    }

                    setSeconds(s);
                  }}
                />

                <Typography color="text.secondary" fontWeight={600}>
                  s
                </Typography>
              </Stack>

              <IconButton
                sx={{ border: theme => `1px solid ${theme.palette.divider}` }}
                onClick={() => setSeconds(seconds - 15)}
                disabled={seconds < 15}
              >
                <ArrowDropDownRounded sx={{ fontSize: '4rem' }} />
              </IconButton>
            </Stack>
          </Stack>

          <Button
            fullWidth
            variant="contained"
            onClick={() => startAndSave()}
            size={pastTimers.length ? 'medium' : 'large'}
            disabled={minutes <= 0 && seconds <= 0}
            sx={{
              fontWeight: 600,
            }}
          >
            {started ? `Stop Timer ${timeMMSS}` : 'Start Timer'}
          </Button>

          {pastTimers.length > 0 && (
            <Stack>
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                gutterBottom
                textAlign="center"
              >
                Past Timers
              </Typography>

              <Stack>
                {pastTimers.map(timer => (
                  <Button
                    key={timer.secondsLeft}
                    disabled={started}
                    sx={{
                      cursor: 'pointer',
                      color: theme => theme.palette.text.primary,
                      border: theme => `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      padding: 1,
                      textAlign: 'center',
                      ':hover': {
                        coor: theme => theme.palette.primary.main,
                      },
                    }}
                    onClick={async () => {
                      setMinutes(timer.minutes);
                      setSeconds(timer.seconds);

                      startAndSave({
                        minutes: timer.minutes,
                        seconds: timer.seconds,
                      });
                    }}
                  >
                    <b>{timer.minutes}</b>m &nbsp;
                    <b>{timer.seconds}</b>s
                  </Button>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Menu>
    </>
  );
};

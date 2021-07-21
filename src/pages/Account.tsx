import { css } from '@emotion/css';
import {
  Box,
  Button,
  CircularProgress,
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Typography,
} from '@material-ui/core';
import { ChevronLeft, ChevronRight } from '@material-ui/icons';
import { formatDistanceToNowStrict } from 'date-fns';
import firebase from 'firebase/app';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Line, LineChart } from 'recharts';

import { Milliseconds, Months, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { auth, db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import { Activity, TrainingLog, TrainingTemplate } from '../interfaces';
import { Color, Columns, Pad, Rows } from '../style';

const baseBg = '#f4f4f4';

/**
 * Presents the currently authenticated user and their logs OR presents another
 * user's account and logs with a button to follow/unfollow.
 */
export const Account: FC = () => {
  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();
  const user = useUser();
  const menu = useMaterialMenu();
  const history = useHistory();

  const [totalLogCount] = useDataState(
    () =>
      db
        .user(userId ?? user.uid)
        .collection(DbPath.UserLogs)
        .get()
        .then(({ size }) => size),
    [userId, user.uid]
  );

  const [logCountPast30Days] = useDataState(() => {
    const past30days = new Date(Date.now() - Milliseconds.Day * 30);
    return db
      .user(userId ?? user.uid)
      .collection(DbPath.UserLogs)
      .where('timestamp', '>', past30days)
      .get()
      .then(({ size }) => size);
  }, [userId, user.uid]);

  const [selectedUser] = useDataState(
    () =>
      db
        .user(userId)
        .get()
        .then(doc => {
          const user = doc.data();
          if (!user) return DataState.error('User document does not exist');
          return user;
        }),
    [userId]
  );

  const deleteAccount = useCallback(async () => {
    menu.close();
    const text = window.prompt('Type "delete" to delete account');
    if (!!text && text?.toLowerCase() !== 'delete') return;
    try {
      await db.user(user.uid).delete();
      if (!auth.currentUser) throw Error('Unreachable');
      await auth.currentUser.delete();
      toast.info('Account deleted successfully.');
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, menu]);

  return (
    <Columns
      pad={Pad.Large}
      className={css`
        height: 100%;
        padding: ${Pad.Small} 0;
        background-color: ${baseBg};
      `}
    >
      <Rows
        center
        className={css`
          margin-left: auto;
        `}
      >
        {userId && <FollowButton />}
        <ClickAwayListener onClickAway={menu.close}>
          <div
            className={css`
              border-radius: 8px;
              padding: 0 ${Pad.XSmall};
              background-color: #fff;
              margin-right: ${Pad.Medium};
            `}
          >
            <IconButton
              disabled={!!userId}
              aria-label="Open account menu"
              aria-controls="account-menu"
              aria-haspopup="true"
              onClick={menu.open}
              size="small"
            >
              <Typography variant="h6" color="textPrimary">
                {userId
                  ? DataState.isReady(selectedUser)
                    ? selectedUser.displayName
                    : null
                  : user.displayName}
              </Typography>
            </IconButton>
            <Menu
              id="account-menu"
              anchorEl={menu.ref}
              open={!!menu.ref}
              onClose={menu.close}
              MenuListProps={{ dense: true }}
            >
              <MenuItem
                onClick={() => {
                  history.push(Paths.library(user.uid));
                }}
              >
                Activity Library
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (!window.confirm('Sign out?')) return;
                  auth.signOut();
                }}
              >
                Sign out
              </MenuItem>
              <MenuItem onClick={deleteAccount}>
                <b>Delete account</b>
              </MenuItem>
            </Menu>
          </div>
        </ClickAwayListener>
      </Rows>
      <Columns
        className={css`
          text-align: center;
        `}
      >
        <Typography variant="body2">Training Logs</Typography>
        {DataState.isReady(totalLogCount) && (
          <Typography
            variant="h2"
            className={css`
              line-height: 0.9em !important;
            `}
          >
            {totalLogCount}
          </Typography>
        )}
      </Columns>
      <Rows
        pad={Pad.Small}
        className={css`
          height: min-height;
          padding: 0 ${Pad.Large};
        `}
      >
        {DataState.isReady(logCountPast30Days) && (
          <Rows
            center
            pad={Pad.Small}
            className={css`
              border-radius: 16px;
              border: 0;
              padding: ${Pad.Small} ${Pad.Medium};
              background-color: #fff;
              box-shadow: 0 16px 32px rgba(0, 0, 0, 0.05);
            `}
          >
            <CircularProgressWithLabel
              value={100 * (logCountPast30Days / 30)}
            />
            <Columns center>
              <Typography variant="subtitle2" color="textSecondary">
                Past 30 days
              </Typography>
              <Typography variant="h6" color="textPrimary">
                {logCountPast30Days}
              </Typography>
            </Columns>
          </Rows>
        )}
      </Rows>
      <TrainingLogsCalendar />
      <TrainingTemplatesView />
    </Columns>
  );
};

const FollowButton: FC = () => {
  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();
  const user = useUser();

  const [isFollowing, setIsFollowing] = useState<DataState<boolean>>(
    DataState.Empty
  );

  // Define `isFollowing` and keep its value up-to-date
  useEffect(() => {
    if (!userId) return;
    return db.user(user.uid).onSnapshot(
      doc => {
        const following = doc.get('following') as string[];
        setIsFollowing(following.includes(userId));
      },
      err => setIsFollowing(DataState.error(err.message))
    );
  }, [userId, user.uid]);

  const toggleFollow = useCallback(async () => {
    if (!userId || !DataState.isReady(isFollowing)) return;
    try {
      const batch = db.batch();
      // Add/remove the authenticated user to/from the viewed users followers
      batch.update(db.user(userId), {
        followers: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(user.uid)
          : firebase.firestore.FieldValue.arrayUnion(user.uid),
      });
      // Add/remove the viewed user to/from the authenticated users follow list
      batch.update(db.user(user.uid), {
        following: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(userId)
          : firebase.firestore.FieldValue.arrayUnion(userId),
      });
      await batch.commit();
    } catch (error) {
      toast.error(error.message);
    }
  }, [userId, user.uid, isFollowing]);

  return (
    <Button variant="text" onClick={toggleFollow} size="small">
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
};

const CircularProgressWithLabel: FC<{ value: number }> = ({ value }) => {
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress
        variant="determinate"
        value={100}
        size={45}
        thickness={3}
        className={css`
          color: #ddd !important;
        `}
      />
      <CircularProgress
        variant="determinate"
        value={value}
        size={45}
        thickness={4}
        className={css`
          position: absolute;
          left: 0;
          color: ${Color.ActionPrimaryBlue} !important;
        `}
      />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography
          variant="caption"
          component="div"
          color="textPrimary"
          className={css`
            // Nudge to center
            margin-bottom: 0 !important;
          `}
        >
          <b>{`${Math.round(value)}%`}</b>
        </Typography>
      </Box>
    </Box>
  );
};

const TrainingTemplatePreview: FC<{
  template: TrainingTemplate;
}> = ({ template }) => {
  const history = useHistory();
  const user = useUser();

  const navigateToTemplate = useCallback(() => {
    const templatePath =
      template.authorId === user.uid
        ? Paths.template(template.id)
        : Paths.templateView(template.authorId, template.id);
    history.push(templatePath);
  }, [user.uid, template, history]);

  /** Total volume calculated for each log in `template.logIds`. */
  const [templateLogVolumes] = useDataState(
    () =>
      Promise.all(
        template.logIds.map(logId =>
          db
            .user(user.uid)
            .collection(DbPath.UserLogs)
            .doc(logId)
            .collection(DbPath.UserLogActivities)
            .withConverter(DbConverter.Activity)
            .get()
            .then(snapshot => ({
              volume: snapshot.docs
                .map(doc => Activity.getVolume(doc.data()))
                .reduce((sum, v) => sum + v, 0),
            }))
        )
      ),
    [user.uid, template]
  );

  const [latestLogDate] = useDataState(async () => {
    if (template.logIds.length === 0) return DataState.Empty;
    // All the Dates of logs created from this template
    const promises = template.logIds.map(logId =>
      db
        .user(user.uid)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .get()
        .then(doc => {
          // `t` could be undefined
          const t: TrainingLog['timestamp'] = doc.get('timestamp');
          return (t as firebase.firestore.Timestamp)?.toDate();
        })
    );
    const logDates = await Promise.all(promises);
    // Convert dates to number to please the TypeScript machine
    const sorted = logDates.filter(_ => _ !== void 0).sort((a, b) => +b - +a);
    if (sorted.length === 0) return DataState.Empty;
    return formatDistanceToNowStrict(sorted[0], { addSuffix: true });
  }, [user.uid, template]);

  return (
    <Columns
      pad={Pad.Small}
      className={css`
        border: 0;
        border-radius: 20px;
        padding: ${Pad.Medium};
        background-color: #fff;
        min-width: 65vw;
        min-height: 150px;
      `}
      onClick={navigateToTemplate}
    >
      <Rows center pad={Pad.Medium}>
        <div
          className={css`
            background-color: ${baseBg};
            border-radius: 20px;
            padding: ${Pad.Medium};
          `}
        >
          <Typography variant="body2" color="textSecondary">
            {TrainingLog.abbreviate(template.title)}
          </Typography>
        </div>
        <Columns>
          <Typography variant="body1" color="textPrimary">
            <b>{template.title}</b>
          </Typography>
          {DataState.isReady(latestLogDate) && (
            <Typography variant="caption" color="textSecondary">
              {latestLogDate}
            </Typography>
          )}
        </Columns>
        <ChevronRight
          fontSize="small"
          className={css`
            color: ${Color.ActionPrimaryBlue} !important;
            margin-left: auto;
          `}
        />
      </Rows>
      <Rows center pad={Pad.Medium}>
        {template.logIds.length > 1 && (
          <DataStateView data={templateLogVolumes}>
            {templateLogVolumes => (
              <LineChart height={60} width={80} data={templateLogVolumes}>
                <Line
                  type="monotone"
                  dot={false}
                  dataKey="volume"
                  strokeWidth={2}
                  stroke="green"
                />
              </LineChart>
            )}
          </DataStateView>
        )}
        {!!template.logIds.length && (
          <Rows
            pad={Pad.Small}
            className={css`
              align-items: center !important;
            `}
          >
            <Typography variant="h5" color="textPrimary">
              <b>{template.logIds.length}</b>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Log{template.logIds.length === 1 ? '' : 's'}
            </Typography>
          </Rows>
        )}
      </Rows>
    </Columns>
  );
};

/**
 * Presents the authenticated user's TrainingLog collection projected over a
 * day-by-day calendar month display.
 */
const TrainingLogsCalendar: FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const user = useUser();

  const [thisMonth, setThisMonth] = useState(new Date().getMonth());
  const monthLength = useMemo(
    () => getMonthLength(new Date(), thisMonth),
    [thisMonth]
  );

  /** Each TrainingLog.id is bucketed into month and day-of-month. */
  // Not every month key-value pair exists and same goes for day-of-month
  const [logs] = useDataState<{
    [month: number]: { [dayDate: number]: TrainingLog['id'] };
  }>(
    () =>
      db
        .user(userId ?? user.uid)
        .collection(DbPath.UserLogs)
        .withConverter(DbConverter.TrainingLog)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => {
          const logsByMonth = {};
          snapshot.docs.forEach(doc => {
            const timestamp = doc.get('timestamp');
            const date = (timestamp as firebase.firestore.Timestamp).toDate();
            const month = date.getMonth();
            if (!logsByMonth[month]) logsByMonth[month] = {};
            // Add TrainingLog entry for the date it was performed
            // This assumes only ONE training log per day
            logsByMonth[month][date.getDate()] = doc.id;
          });
          return logsByMonth;
        }),
    [userId, user.uid]
  );

  return (
    <DataStateView data={logs}>
      {logs => (
        <Columns
          className={css`
            padding: ${Pad.Small} 0;
            background-color: #fff;
            border-radius: 20px;
            box-shadow: 0 16px 32px rgba(0, 0, 0, 0.05);
          `}
        >
          <Rows
            center
            pad={Pad.Medium}
            className={css`
              justify-content: center;
            `}
          >
            <IconButton
              aria-label="View previous month of logs"
              size="small"
              onClick={() => {
                setThisMonth(thisMonth - 1);
              }}
            >
              <ChevronLeft />
            </IconButton>
            <Typography variant="body2" color="textSecondary">
              {Months[thisMonth]}
            </Typography>
            <IconButton
              aria-label="View next month of logs"
              size="small"
              onClick={() => {
                setThisMonth(thisMonth + 1);
              }}
            >
              <ChevronRight />
            </IconButton>
          </Rows>
          <Rows
            className={css`
              flex-wrap: wrap;
            `}
          >
            {Array(monthLength)
              .fill(null)
              .map((_, dayOfMonth) => (
                <TrainingCalendarLog
                  key={dayOfMonth}
                  dayOfMonth={dayOfMonth}
                  logId={logs?.[thisMonth]?.[dayOfMonth]}
                />
              ))}
          </Rows>
        </Columns>
      )}
    </DataStateView>
  );
};

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * @note When passing `monthIndex` remember that January is index 0.
 * @example const numDaysInFeb = getMonthLength(new Date(), 1)
 */
const getMonthLength = (now: Date, monthIndex: number): number => {
  const year = now.getFullYear();
  const lengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return lengths[monthIndex];
};

const TrainingTemplatesView: FC = () => {
  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();
  const user = useUser();

  const [templates] = useDataState(
    () =>
      db
        .user(userId ?? user.uid)
        .collection(DbPath.UserTemplates)
        .withConverter(DbConverter.TrainingTemplate)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [userId, user.uid]
  );

  return (
    <DataStateView data={templates}>
      {templates =>
        templates.length ? (
          <Rows
            pad={Pad.Medium}
            className={css`
              overflow-x: scroll;
              overflow-y: hidden;
              margin-left: ${Pad.Large};
              & > *:last-child {
                margin-right: ${Pad.Large};
              }
            `}
          >
            <>
              {templates.map(t => (
                <TrainingTemplatePreview key={t.id} template={t} />
              ))}
              <TrainingTemplateCreate />
            </>
          </Rows>
        ) : (
          <TrainingTemplateCreate />
        )
      }
    </DataStateView>
  );
};

/**
 * Presents an active, clickable calendar date ("11") if a `logId` prop is
 * given, otherwise a neutral, non-interactable date display.
 *
 * Calendar dates with logs for those days display Popover menus onClick.
 */
const TrainingCalendarLog: FC<{
  dayOfMonth: number;
  logId?: string;
}> = ({ dayOfMonth, logId }) => {
  const history = useHistory();
  const { userId } = useParams<{ userId?: string }>();
  const user = useUser();

  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const open = !!anchorEl;
  const id = open ? 'training-log-popover' : undefined;

  /**
   * The TrainingLog data for the log for this data, if it exists.
   * This is always `DataState.Empty` if the Popover is never opened.
   */
  const [log] = useDataState(async () => {
    // nah
    if (!open) return DataState.Empty;
    // fetch the log, the thing is open
    const data = await db
      .user(userId ?? user.uid)
      .collection(DbPath.UserLogs)
      .withConverter(DbConverter.TrainingLog)
      .doc(logId)
      .get()
      .then(doc => doc.data());
    if (!data) return DataState.error('Log not found');
    return data;
  }, [open, logId, userId, user.uid]);

  // How many times have we done this?
  const logDate = DataState.map(log, l =>
    (l.timestamp as firebase.firestore.Timestamp)?.toDate()
  );

  return (
    <IconButton
      size="small"
      className={css`
        /** Up to seven items per row */
        flex-basis: 14.28% !important;

        & p {
          padding: ${Pad.XSmall} 0 !important;
          width: 4ch;
        }
      `}
      onClick={logId ? event => setAnchorEl(event.currentTarget) : undefined}
    >
      {logId ? (
        <>
          <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
            transformOrigin={{ vertical: 'center', horizontal: 'center' }}
          >
            <ClickAwayListener onClickAway={() => setAnchorEl(null)}>
              <Columns
                pad={Pad.Small}
                className={css`
                  padding: ${Pad.Medium};
                `}
              >
                <DataStateView
                  data={DataState.all<[TrainingLog, Date]>(log, logDate)}
                >
                  {([log, logDate]) => (
                    <>
                      <Rows pad={Pad.Medium} center>
                        <Columns
                          center
                          className={css`
                            background-color: ${baseBg};
                            border-radius: 20px;
                            padding: ${Pad.Small} ${Pad.Medium};
                            font-weight: 600 !important;
                          `}
                        >
                          <Typography variant="overline" color="textSecondary">
                            {Months[logDate.getMonth()].slice(0, 3)}
                          </Typography>
                          <Typography variant="body1" color="textSecondary">
                            {logDate.getDate() + 1}
                          </Typography>
                        </Columns>
                        <Columns>
                          <Typography variant="body1" color="textPrimary">
                            {log.title}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatDistanceToNowStrict(logDate, {
                              addSuffix: true,
                            })}
                          </Typography>
                        </Columns>
                      </Rows>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => history.push(Paths.logEditor(logId))}
                        size="large"
                      >
                        Go
                        <ChevronRight fontSize="small" />
                      </Button>
                    </>
                  )}
                </DataStateView>
              </Columns>
            </ClickAwayListener>
          </Popover>
          <Typography
            aria-describedby={id}
            variant="body1"
            className={css`
              color: ${Color.ActionPrimaryBlue};
              background-color: ${baseBg};
              border-radius: 50%;
            `}
          >
            {dayOfMonth + 1}
          </Typography>
        </>
      ) : (
        <Typography variant="body1" color="textSecondary">
          {dayOfMonth + 1}
        </Typography>
      )}
    </IconButton>
  );
};

const TrainingTemplateCreate: FC = () => {
  const user = useUser();
  const history = useHistory();

  const createTemplate = useCallback(async () => {
    const title = window.prompt('Template title...');
    if (!title) return;
    try {
      const docRef = await db
        .user(user.uid)
        .collection(DbPath.UserTemplates)
        .add(TrainingTemplate.create({ authorId: user.uid, title }));
      history.push(Paths.template(docRef.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, history]);

  return (
    <Columns
      pad={Pad.Small}
      className={css`
        border: 0;
        background-color: #fff;
        border-radius: 20px;
        padding: ${Pad.Medium};
      `}
      onClick={createTemplate}
    >
      <Columns center pad={Pad.Medium}>
        <Rows center pad={Pad.Large}>
          <Typography variant="body2" color="textSecondary">
            New Template
          </Typography>
          <ChevronRight
            fontSize="small"
            className={css`
              color: ${Color.ActionPrimaryBlue} !important;
              margin-left: auto;
            `}
          />
        </Rows>
        <div
          className={css`
            background-color: ${baseBg};
            border-radius: 20px;
            padding: ${Pad.Medium};
          `}
        >
          <Typography variant="body1" color="textSecondary">
            +
          </Typography>
        </div>
      </Columns>
    </Columns>
  );
};

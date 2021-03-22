import { css } from '@emotion/css';
import {
  Button,
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { MoreHoriz } from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { TrainingLogMenuButton } from '../components/TrainingLogMenuButton';
import { Format, Milliseconds, Paths, Weekdays } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { auth, db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import { TrainingLog } from '../interfaces';
import { Color, Columns, Pad, Rows } from '../style';

const modulo = (n: number, m: number) => ((n % m) + m) % m;

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

  const [templates] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(userId ?? user.uid)
        .collection(DbPath.UserTemplates)
        .withConverter(DbConverter.TrainingTemplate)
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [userId, user.uid]
  );

  const [logs] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(userId ?? user.uid)
        .collection(DbPath.UserLogs)
        .withConverter(DbConverter.TrainingLog)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [userId, user.uid]
  );

  /**
   * A list of days of the week as a string and whether a log for that day
   * exists or not.
   */
  const [logsPast7Days] = useDataState(async () => {
    const past7Days = new Date(Date.now() - Milliseconds.Day * 7);
    const snapshot = await db
      .collection(DbPath.Users)
      .doc(userId ?? user.uid)
      .collection(DbPath.UserLogs)
      .withConverter(DbConverter.TrainingLog)
      .where('timestamp', '>', past7Days)
      .get();
    const loggedDates = snapshot.docs.flatMap(doc => {
      const log = doc.data();
      const date = TrainingLog.getDate(log);
      return date ? [date.getDate()] : [];
    });
    return Array<Date>(7)
      .fill(new Date())
      .map((today, index): [string, boolean] => {
        const date = today.getDate() - index;
        const dayIndex = modulo(today.getDay() - index, 7);
        const dayName = Weekdays[dayIndex].slice(0, 2);
        return [dayName, loggedDates.includes(date)];
      });
  }, [userId, user.uid]);

  const [logCountPast30Days] = useDataState(() => {
    const past30days = new Date(Date.now() - Milliseconds.Day * 30);
    return db
      .collection(DbPath.Users)
      .doc(userId ?? user.uid)
      .collection(DbPath.UserLogs)
      .where('timestamp', '>', past30days)
      .get()
      .then(({ size }) => size);
  }, [userId, user.uid]);

  const [selectedUser] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .withConverter(DbConverter.User)
        .doc(userId)
        .get()
        .then(doc => {
          const user = doc.data();
          if (!user) return DataState.error('User document does not exist');
          return user;
        }),
    [userId]
  );

  const deleteAccount = useCallback(async () => {
    if (!window.confirm('Delete account?')) return;
    try {
      await db.collection(DbPath.Users).doc(user.uid).delete();
      if (!auth.currentUser) throw Error('Impossible');
      await auth.currentUser.delete();
      toast.info('Account deleted successfully.');
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid]);

  return (
    <Columns
      pad={Pad.Medium}
      className={css`
        height: 100%;
        overflow-y: scroll;
        padding: ${Pad.Medium} ${Pad.Large};
      `}
    >
      <Rows center pad={Pad.Small}>
        <Typography variant="h4" color="textPrimary">
          {userId
            ? DataState.isReady(selectedUser)
              ? selectedUser.displayName
              : null
            : user.displayName}
        </Typography>
        {userId && <FollowButton />}
        {!userId && (
          <ClickAwayListener onClickAway={menu.close}>
            <div>
              <IconButton
                aria-label="Open account menu"
                aria-controls="account-menu"
                aria-haspopup="true"
                onClick={menu.open}
                size="small"
              >
                <MoreHoriz
                  className={css`
                    color: ${Color.ActionSecondaryGray};
                  `}
                />
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
        )}
      </Rows>
      <Typography variant="body2" color="textSecondary">
        <b>Templates</b>
      </Typography>
      <div>
        <DataStateView data={templates}>
          {templates =>
            templates.length ? (
              <Rows
                pad={Pad.Medium}
                padding={`0 ${Pad.Large}`}
                className={css`
                  overflow-x: scroll;
                `}
              >
                {templates.map(template => (
                  <Columns
                    key={template.id}
                    onClick={() => {
                      const templatePath =
                        template.authorId === user.uid
                          ? Paths.template(template.id)
                          : Paths.templateView(template.authorId, template.id);
                      history.push(templatePath);
                    }}
                    className={css`
                      border: 1px solid ${Color.ActionPrimaryBlue};
                      border-radius: 5px;
                      padding: ${Pad.Small} ${Pad.Medium};
                    `}
                    between
                  >
                    <Typography variant="body2" color="textPrimary">
                      {template.title}
                    </Typography>
                    <Statistic
                      text="logs from template"
                      value={template.logIds.length}
                    />
                  </Columns>
                ))}
              </Rows>
            ) : (
              <Typography variant="body2" color="textSecondary">
                <i>No templates</i>
              </Typography>
            )
          }
        </DataStateView>
      </div>
      <DataStateView data={logs}>
        {logs =>
          logs.length ? (
            <>
              <Rows
                pad={Pad.Small}
                className={css`
                  height: min-height;
                `}
              >
                <Statistic text="training logs" value={logs.length} />
                {DataState.isReady(logCountPast30Days) && (
                  <Statistic
                    text="in the past 30 days"
                    value={logCountPast30Days}
                  />
                )}
              </Rows>
              <DataStateView data={logsPast7Days}>
                {past7Days => (
                  <Columns pad={Pad.Medium}>
                    <Typography variant="body2" color="textSecondary">
                      <b>Past 7 Days</b>
                    </Typography>
                    <Rows between padding={`0 ${Pad.Large} ${Pad.Small}`}>
                      {past7Days.map(([dayName, hasLog]) => (
                        <div key={dayName}>
                          <p
                            className={css`
                              color: ${hasLog
                                ? Color.FontPrimary
                                : Color.FontSecondary};
                              font-weight: ${hasLog ? 600 : 400};
                            `}
                          >
                            {dayName}
                          </p>
                          {hasLog && (
                            <div
                              className={css`
                                height: 2px;
                                width: 100%;
                                background-color: ${Color.ActionPrimaryBlue};
                              `}
                            />
                          )}
                        </div>
                      ))}
                    </Rows>
                  </Columns>
                )}
              </DataStateView>
              <Columns pad={Pad.Large}>
                {logs.map(log => (
                  <TrainingLogPreview log={log} key={log.id} />
                ))}
              </Columns>
            </>
          ) : (
            <Typography variant="body1" color="textSecondary">
              <i>No training found.</i>
            </Typography>
          )
        }
      </DataStateView>
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
    return db
      .collection(DbPath.Users)
      .doc(user.uid)
      .onSnapshot(
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
      batch.update(db.collection(DbPath.Users).doc(userId), {
        followers: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(user.uid)
          : firebase.firestore.FieldValue.arrayUnion(user.uid),
      });
      // Add/remove the viewed user to/from the authenticated users follow list
      batch.update(db.collection(DbPath.Users).doc(user.uid), {
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
    <Button variant="text" onClick={toggleFollow}>
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
};

const Statistic: FC<{ text: string; value: React.ReactNode }> = ({
  text,
  value,
}) => {
  return (
    <Rows
      className={css`
        align-items: center !important;
      `}
    >
      <p
        className={css`
          font-size: 2.2em;
          line-height: 1em;
          color: ${Color.ActionPrimaryBlue};
        `}
      >
        {value}
      </p>
      <p
        className={css`
          font-size: 0.75em;
          font-weight: 600;
          text-transform: uppercase;
          color: ${Color.FontSecondary};
          width: 11ch;
          overflow-x: hidden;
        `}
      >
        {text}
      </p>
    </Rows>
  );
};

const TrainingLogPreview: FC<{ log: TrainingLog }> = ({ log }) => {
  const history = useHistory();
  const location = useLocation();

  /** If this userId exists, then we are viewing someone elses account.  */
  const { userId } = useParams<{ userId?: string }>();

  const logDate = TrainingLog.getDate(log);

  const logDateDistance = useMemo(
    () => TrainingLog.getDistance(log.timestamp),
    [log.timestamp]
  );

  return (
    <Rows
      className={css`
        border-radius: 5px;
        border: 1px solid ${Color.ActionSecondaryGray};
        padding: ${Pad.Large};
        min-height: fit-content;
      `}
      between
      center
    >
      <Columns
        onClick={
          userId
            ? () => history.push(Paths.logView(userId, log.id))
            : () => history.push(Paths.logEditor(log.id), { from: location })
        }
      >
        <Typography variant="body1" color="textPrimary">
          {log.title}
        </Typography>
        {logDate && (
          <Typography variant="body2" color="textSecondary">
            {format(logDate, `${Format.time}`)} / {logDateDistance}
          </Typography>
        )}
      </Columns>
      {!userId && <TrainingLogMenuButton log={log} />}
    </Rows>
  );
};

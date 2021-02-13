import { css } from '@emotion/css';
import {
  Button,
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { MoreHoriz, Replay } from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Format, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { auth, db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useNewTraining, useUser } from '../hooks';
import { ActivityStatus, TrainingLog } from '../interfaces';
import { Columns, Pad, Rows } from '../style';

/**
 * Presents the currently authenticated user and their logs OR presents another
 * user's account and logs with a button to follow/unfollow.
 */
export const Account: FC = () => {
  const [isFollowing, setIsFollowing] = useState<DataState<boolean>>(
    DataState.Empty
  );

  const user = useUser();
  const newTraining = useNewTraining();
  const menu = useMaterialMenu();

  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();

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

  const [logCountLast30Days] = useDataState(() => {
    const last30days = new Date(Date.now() - 2592000000);
    return db
      .collection(DbPath.Users)
      .doc(userId ?? user.uid)
      .collection(DbPath.UserLogs)
      .where('timestamp', '>', last30days)
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

  /**
   * If the current user is following the viewed user, unfollow them. Otherwise
   * follow them. This is a no-op if viewing one's own account page.
   */
  const toggleFollow = useCallback(async () => {
    if (!userId || !DataState.isReady(isFollowing)) return;
    try {
      const batch = db.batch();
      batch.update(db.collection(DbPath.Users).doc(userId), {
        followers: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(user.uid)
          : firebase.firestore.FieldValue.arrayUnion(user.uid),
      });
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
        {DataState.isReady(isFollowing) && (
          <Button variant="text" onClick={toggleFollow}>
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
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
                    color: lightgray;
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
                {DataState.isReady(logCountLast30Days) && (
                  <Statistic
                    text="in the last 30 days"
                    value={logCountLast30Days}
                  />
                )}
              </Rows>
              <Columns pad={Pad.Large}>
                {logs.map(log => (
                  <TrainingLogPreview log={log} key={log.id} />
                ))}
              </Columns>
            </>
          ) : (
            <Columns pad={Pad.Large}>
              <Typography variant="body1" color="textSecondary">
                You haven't trained a bit!
              </Typography>
              <Button variant="contained" color="primary" onClick={newTraining}>
                Start Training
              </Button>
            </Columns>
          )
        }
      </DataStateView>
    </Columns>
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
          color: royalblue;
        `}
      >
        {value}
      </p>
      <p
        className={css`
          font-size: 0.75em;
          font-weight: 500;
          text-transform: uppercase;
          color: rgba(0, 0, 0, 0.52);
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
  const user = useUser();
  const history = useHistory();
  const location = useLocation();

  /** If this userId exists, then we are viewing someone elses account.  */
  const { userId } = useParams<{ userId?: string }>();

  const logDate = TrainingLog.getDate(log);

  const repeatTraining = useCallback(async () => {
    if (!window.confirm('Repeat this training?')) return;
    try {
      const [logRef, activities] = await Promise.all([
        db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserLogs)
          .withConverter(DbConverter.TrainingLog)
          .add({
            ...log,
            title: 'Repeat - ' + log.title,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          }),
        db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserLogs)
          .doc(log.id)
          .collection(DbPath.UserLogActivities)
          .withConverter(DbConverter.Activity)
          .get()
          .then(snapshot =>
            snapshot.docs.map(doc => {
              const activity = doc.data();
              activity.sets.forEach(set => {
                set.status = ActivityStatus.Unattempted;
              });
              return activity;
            })
          ),
      ]);
      const activitiesCollection = logRef.collection(DbPath.UserLogActivities);
      const writeBatch = db.batch();
      activities.forEach(a => {
        writeBatch.set(activitiesCollection.doc(a.id), a);
      });
      await writeBatch.commit();
      history.push(Paths.logEditor(logRef.id), { from: location });
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, history, location]);

  return (
    <Rows
      className={css`
        border-radius: 5px;
        box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);
        padding: ${Pad.Medium} ${Pad.Large};
        min-height: fit-content;
      `}
    >
      <Columns
        onClick={
          userId
            ? () => history.push(Paths.logView(userId, log.id))
            : () => history.push(Paths.logEditor(log.id), { from: location })
        }
      >
        <Typography variant="body1" color="textSecondary">
          {log.title}
        </Typography>
        {logDate && (
          <Typography variant="body2" color="textPrimary">
            {format(logDate, `${Format.date} - ${Format.time}`)}
          </Typography>
        )}
      </Columns>
      {!userId && (
        <IconButton
          size="medium"
          edge="end"
          aria-label="Repeat this training"
          onClick={repeatTraining}
          className={css`
            margin-left: auto !important;
          `}
        >
          <Replay />
        </IconButton>
      )}
    </Rows>
  );
};

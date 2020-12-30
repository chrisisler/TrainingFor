import React, { FC, useCallback, useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { Typography, Button, IconButton } from '@material-ui/core';
import firebase from 'firebase/app';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import format from 'date-fns/format';
import { Replay } from '@material-ui/icons';

import { Pad, Columns, Rows } from '../style';
import { useUser } from '../useUser';
import { auth, db, DbPath } from '../firebase';
import { TrainingLog, Activity, ActivityStatus, User } from '../interfaces';
import { DataState, DataStateView, useDataState } from '../DataState';
import { Format, Paths } from '../constants';

/**
 * Presents the currently authenticated user and their logs OR presents another
 * user's account and logs with a button to follow/unfollow.
 */
export const Account: FC = () => {
  const [isFollowing, setIsFollowing] = useState<DataState<boolean>>(
    DataState.Empty
  );

  // TODO Remove setUser calls - Is this needed still?
  const [user, setUser] = useUser();

  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();

  const [logs] = useDataState<TrainingLog[]>(
    async () =>
      db
        .collection(DbPath.Users)
        .doc(userId ?? user?.uid)
        .collection(DbPath.UserLogs)
        .orderBy('timestamp', 'desc')
        .get()
        .then(({ docs }) =>
          docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog))
        ),
    [userId, user?.uid]
  );

  const [selectedUser] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(userId)
        .get()
        .then(doc => ({ ...doc.data(), id: doc.id } as User)),
    [userId]
  );

  /**
   * If the current user is following the viewed user, unfollow them. Otherwise
   * follow them. This is a no-op if viewing one's own account page.
   */
  const toggleFollow = useCallback(async () => {
    if (!user || !userId || !DataState.isReady(isFollowing)) return;
    try {
      const batch = db.batch();
      batch.update(db.collection(DbPath.Users).doc(userId), {
        followers: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(user.uid)
          : firebase.firestore.FieldValue.arrayUnion(user.uid),
      });
      batch.update(db.collection(DbPath.Users).doc(user?.uid), {
        following: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(userId)
          : firebase.firestore.FieldValue.arrayUnion(userId),
      });
      await batch.commit();
    } catch (error) {
      alert(error.message);
    }
  }, [userId, user, isFollowing]);

  const signOut = useCallback(() => {
    auth.signOut();
    setUser(null);
  }, [setUser]);

  // Define `isFollowing` and keep its value up-to-date
  useEffect(() => {
    if (!userId || !DataState.isReady(selectedUser) || !user) return;
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
  }, [userId, selectedUser, user]);

  if (!user) return null;

  return (
    <Columns
      pad={Pad.Small}
      className={css`
        height: 100%;
        overflow-y: scroll;
        padding: 0 ${Pad.Large} ${Pad.Large};
      `}
    >
      <Rows center maxWidth>
        {!userId && (
          <Button
            variant="text"
            onClick={signOut}
            className={css`
              margin-left: auto !important;
            `}
          >
            Sign Out
          </Button>
        )}
        {userId && DataState.isReady(isFollowing) && (
          <Button
            variant="text"
            onClick={toggleFollow}
            className={css`
              margin-left: auto !important;
            `}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
      </Rows>
      <Typography variant="h4" color="textSecondary" gutterBottom>
        {userId && DataState.isReady(selectedUser)
          ? selectedUser.displayName
          : user.displayName}
      </Typography>
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Training Logs
      </Typography>
      <DataStateView
        data={logs}
        error={() => (
          <Typography variant="body2" color="error">
            Something went wrong.
          </Typography>
        )}
      >
        {logs => (
          <Columns pad={Pad.Large}>
            {logs.map(log => (
              <TrainingLogPreview log={log} key={log.id} />
            ))}
          </Columns>
        )}
      </DataStateView>
    </Columns>
  );
};

const TrainingLogPreview: FC<{ log: TrainingLog }> = ({ log }) => {
  const [user] = useUser();
  const history = useHistory();
  const location = useLocation();

  /** If this userId exists, then we are viewing someone elses account.  */
  const { userId } = useParams<{ userId?: string }>();

  const logDate = TrainingLog.getDate(log);

  const navigateToTraining = useCallback(
    () => history.push(Paths.logEditor(log.id), { from: location }),
    [history, location, log.id]
  );

  const navigateToViewedUserLog = useCallback(
    () => history.push(Paths.logView(userId, log.id)),
    [history, userId, log.id]
  );

  const repeatTraining = useCallback(async () => {
    if (!user) return;
    if (!window.confirm('Repeat this training?')) return;
    try {
      const repeatLog: Omit<TrainingLog, 'id'> = {
        ...log,
        title: 'Repeat - ' + log.title,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
      const [logRef, activities] = await Promise.all([
        db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserLogs)
          .add(repeatLog),
        db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserLogs)
          .doc(log.id)
          .collection(DbPath.UserLogActivities)
          .get()
          .then(snapshot =>
            snapshot.docs.map(doc => {
              const activity = { ...doc.data(), id: doc.id } as Activity;
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
      navigateToTraining();
    } catch (error) {
      alert(error.message);
    }
  }, [user, log, navigateToTraining]);

  return (
    <Rows
      className={css`
        border-radius: 5px;
        box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);
        padding: ${Pad.Medium} ${Pad.Large};
        min-height: fit-content;
      `}
    >
      <Columns onClick={userId ? navigateToViewedUserLog : navigateToTraining}>
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

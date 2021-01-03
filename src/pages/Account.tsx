import { css } from '@emotion/css';
import { Button, IconButton, Typography } from '@material-ui/core';
import { Replay } from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';

import { Format, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { auth, db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
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

  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();

  const [logs] = useDataState(
    async () =>
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
      alert(error.message);
    }
  }, [userId, user.uid, isFollowing]);

  // Define `isFollowing` and keep its value up-to-date
  useEffect(() => {
    if (!userId || !DataState.isReady(selectedUser)) return;
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
  }, [userId, selectedUser, user.uid]);

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
            onClick={() => auth.signOut()}
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
      alert(error.message);
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

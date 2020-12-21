import React, { FC, useCallback } from 'react';
import { css } from '@emotion/css';
import { Typography, Button, IconButton } from '@material-ui/core';
import firebase from 'firebase/app';
import { useHistory, useLocation } from 'react-router-dom';
import format from 'date-fns/format';
import { Replay } from '@material-ui/icons';

import { Pad, Columns, Rows } from '../style';
import { useUser } from '../useUser';
import { auth, db, DbPath } from '../firebase';
import { TrainingLog, Activity, ActivityStatus } from '../interfaces';
import { DataState, DataStateView, useDataState } from '../DataState';
import { Format, Paths } from '../constants';
import { Loading } from '../components/Loading';

export const Account: FC = () => {
  const [user, setUser] = useUser();

  const signOut = useCallback(() => {
    auth.signOut();
    setUser(null);
  }, [setUser]);

  // Since logs do not update while we are viewing them, we do not need to
  // maintain a database subscription
  const [logs] = useDataState<TrainingLog[]>(
    async () =>
      !user
        ? DataState.Empty
        : db
            .collection(DbPath.Users)
            .doc(user.uid)
            .collection(DbPath.UserLogs)
            .orderBy('timestamp', 'desc')
            .get()
            .then(({ docs }) =>
              docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog))
            ),
    [user]
  );

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
        <Button
          variant="text"
          onClick={signOut}
          className={css`
            margin-left: auto !important;
          `}
        >
          Sign Out
        </Button>
      </Rows>
      <Typography variant="h4" color="textSecondary" gutterBottom>
        {user.displayName}
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
              <TrainingLogView log={log} key={log.id} />
            ))}
          </Columns>
        )}
      </DataStateView>
    </Columns>
  );
};

const TrainingLogView: FC<{ log: TrainingLog }> = ({ log }) => {
  const [user] = useUser();
  const history = useHistory();
  const location = useLocation();

  const logDate = log.timestamp
    ? (log.timestamp as firebase.firestore.Timestamp)?.toDate()
    : null;

  // TODO Switch to declarative Redirect
  const navigateToTraining = useCallback(
    () => history.push(Paths.logEditor(log.id), { from: location }),
    [history, location, log.id]
  );

  const repeatTraining = useCallback(async () => {
    if (!user) return;
    if (!window.confirm('Repeat this training?')) return;
    try {
      const repeatLog: Omit<TrainingLog, 'id'> = {
        title: 'Repeat - ' + log.title,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        notes: null,
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
  }, [user, log.id, log.title, navigateToTraining]);

  return (
    <Rows
      className={css`
        border-radius: 5px;
        box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);
        padding: ${Pad.Medium} ${Pad.Large};
        min-height: fit-content;
      `}
    >
      <Columns onClick={navigateToTraining}>
        <Typography variant="body1" color="textSecondary">
          {log.title}
        </Typography>
        {logDate && (
          <Typography variant="body2" color="textPrimary">
            {format(logDate, `${Format.date} - ${Format.time}`)}
          </Typography>
        )}
      </Columns>
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
    </Rows>
  );
};

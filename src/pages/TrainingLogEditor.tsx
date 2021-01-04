import { css } from '@emotion/css';
import styled from '@emotion/styled';
import { Button, IconButton, Typography } from '@material-ui/core';
import { ArrowBackIosRounded, DeleteOutline, Done } from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';

import { TrainingLogEditorView } from '../components/TrainingLogView';
import { Format, Paths } from '../constants';
import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { Activity, TrainingLog } from '../interfaces';
import { Columns, Pad, Rows } from '../style';

const AddActivityInput = styled.input`
  box-sizing: content-box;
  width: 100%;
  padding: ${Pad.Medium};
  border: 1px solid lightgray;
  border-radius: 3px;
  font-size: 1em;
`;

export const TrainingLogEditor: FC = () => {
  const [activityName, setActivityName] = useState<string>('');

  const location = useLocation<{ from?: Location }>();
  const history = useHistory();
  const user = useUser();
  const { logId } = useParams<{ logId?: string }>();

  const [logDoc, setLogDoc] = useState<
    DataState<firebase.firestore.DocumentSnapshot<TrainingLog>>
  >(DataState.Loading);

  const log = DataState.map(logDoc, doc => {
    const log = doc.data();
    if (!log) return DataState.error('TrainingLog document does not exist.');
    return log;
  });

  const logDate = DataState.map(log, l => TrainingLog.getDate(l));

  // Subscribe to updates to the TrainingLog ID from the URL
  useEffect(() => {
    if (!logId) return;
    return db
      .collection(DbPath.Users)
      .doc(user.uid)
      .collection(DbPath.UserLogs)
      .withConverter(DbConverter.TrainingLog)
      .doc(logId)
      .onSnapshot(
        document => setLogDoc(document),
        err => setLogDoc(DataState.error(err.message))
      );
  }, [user.uid, logId]);

  const navigateToAccount = useCallback(() => {
    setLogDoc(DataState.Empty);
    history.push(Paths.account);
  }, [setLogDoc, history]);

  const renameLog = useCallback(() => {
    const title = DataState.unwrap(DataState.map(log, log => log.title));
    const newTitle = window.prompt('Update training log title', title);
    if (!newTitle) return;
    db.collection(DbPath.Users)
      .doc(user.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .set({ title: newTitle } as Partial<TrainingLog>, { merge: true })
      .catch(error => {
        alert(error.message);
      });
  }, [user.uid, logId, log]);

  const addActivity = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      try {
        event.preventDefault();
        if (!activityName.length || !DataState.isReady(logDoc)) return;
        setActivityName('');
        // Look to the previous activity to determine the position
        // number of the activity being added
        // TODO Combine TrainingLogView into this so we can
        // use `activities` array from use effect instead of hitting DB
        const prevMaxPosition = await db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserLogs)
          .doc(logDoc.id)
          .collection(DbPath.UserLogActivities)
          .orderBy('position', 'desc')
          .limit(1)
          .get()
          .then(({ empty, docs }) =>
            empty ? 0 : (docs[0].get('position') as number)
          );
        const newActivity: Omit<Activity, 'id'> = {
          name: activityName,
          notes: null,
          sets: [],
          position: prevMaxPosition + 1,
          attachmentUrl: null,
        };
        db.collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserLogs)
          .doc(logDoc.id)
          .collection(DbPath.UserLogActivities)
          .add(newActivity);
      } catch (error) {
        alert(error.message);
      }
    },
    [activityName, user.uid, logDoc]
  );

  const deleteLog = useCallback(() => {
    if (!DataState.isReady(logDoc)) return;
    if (!window.confirm('Delete this training log forever?')) return;
    logDoc.ref
      .delete()
      .catch(error => {
        alert(error.message);
      })
      .finally(() => {
        history.push(Paths.account);
      });
  }, [logDoc, history]);

  if (!logId) return null;

  return (
    <DataStateView
      data={log}
      error={() => (
        <Typography variant="h4" color="textPrimary">
          Error
        </Typography>
      )}
    >
      {log => (
        <Columns
          pad={Pad.Small}
          className={css`
            height: 100%;
          `}
        >
          <Rows between center maxWidth padding={`0 ${Pad.Medium}`}>
            <IconButton aria-label="Done training" onClick={navigateToAccount}>
              {location.state?.from?.pathname.includes(Paths.account) ? (
                <ArrowBackIosRounded color="primary" />
              ) : (
                <Done color="primary" />
              )}
            </IconButton>
            <IconButton aria-label="Edit log name" onClick={renameLog}>
              <Typography variant="subtitle1" color="textSecondary">
                {log.title}
              </Typography>
            </IconButton>
            <IconButton aria-label="Delete training log" onClick={deleteLog}>
              <DeleteOutline color="action" />
            </IconButton>
          </Rows>
          <Columns
            pad={Pad.Small}
            padding={`0 ${Pad.Large} ${Pad.Medium}`}
            className={css`
              border-bottom: 1px solid lightgray;
              min-height: fit-content;
            `}
          >
            {DataState.isReady(logDate) &&
              (!logDate ? null : (
                <Typography variant="body1" color="textPrimary">
                  {format(logDate, Format.date)}
                  <br />
                  {format(logDate, Format.time)}
                </Typography>
              ))}
            <Rows maxWidth as="form" onSubmit={addActivity}>
              <AddActivityInput
                type="text"
                placeholder="Enter Activity"
                value={activityName}
                onChange={event => setActivityName(event.target.value)}
              />
              {activityName.length > 0 && (
                <Button
                  variant="outlined"
                  color="primary"
                  className={css`
                    margin: 0 0 0 ${Pad.Medium} !important;
                  `}
                  onClick={addActivity}
                >
                  Add
                </Button>
              )}
            </Rows>
          </Columns>
          <TrainingLogEditorView logAuthorId={user.uid} logId={logId} />
        </Columns>
      )}
    </DataStateView>
  );
};

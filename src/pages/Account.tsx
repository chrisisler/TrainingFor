import React, { FC, useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/css';
import {
  Typography,
  CircularProgress,
  Button,
  IconButton,
} from '@material-ui/core';
import firebase from 'firebase/app';
import { useHistory } from 'react-router-dom';
import format from 'date-fns/format';
import { Layers, LayersClear } from '@material-ui/icons';

import { Pad, Columns, Rows } from '../style';
import { useUser } from '../useUser';
import { auth, db, DbPath } from '../firebase';
import { TrainingLog, Activity, ActivityStatus } from '../interfaces';
import { DataState, DataStateView } from '../DataState';
import { Format } from '../constants';

const CenteredContainer = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
`;

export const Account: FC = () => {
  const [logs, setLogs] = useState<DataState<TrainingLog[]>>(DataState.Loading);
  const [templateLogs, setTemplateLogs] = useState<DataState<TrainingLog[]>>(
    DataState.Empty
  );

  const history = useHistory();
  const [user] = useUser();

  const addTemplate = useCallback(
    async (log: TrainingLog) => {
      if (!user) return;
      if (!window.confirm('Create a training template from this log?')) return;
      try {
        // Get the logs activities with all sets Unattempted.
        const activities = (
          await db
            .collection(DbPath.Users)
            .doc(user?.uid)
            .collection(DbPath.UserLogs)
            .doc(log.id)
            .collection(DbPath.UserLogActivities)
            .get()
        ).docs.map(doc => {
          const activity = { ...doc.data(), id: doc.id } as Activity;
          activity.sets = activity.sets.map(set => {
            set.status = ActivityStatus.Unattempted;
            return set;
          });
          return activity;
        });
        // Create the template and add it to the users templates
        const templateRef = await db
          .collection(DbPath.Users)
          .doc(user?.uid)
          .collection(DbPath.UserTemplateLogs)
          .add(log);
        // TODO Set window scroll Y to zero here, scroll to the top
        // Add each Activity to the template from the training log
        const activitiesCollection = templateRef.collection(
          DbPath.UserLogActivities
        );
        const batchAdd = db.batch();
        activities.forEach(activity => {
          const ref = activitiesCollection.doc(activity.id);
          batchAdd.set(ref, activity);
        });
        await batchAdd.commit();
      } catch (error) {
        alert(error.message);
      }
    },
    [user]
  );

  const deleteTemplate = useCallback(
    async (template: TrainingLog) => {
      if (!window.confirm(`Remove template? ${template.title}`)) return;
      try {
        db.collection(DbPath.Users)
          .doc(user?.uid)
          .collection(DbPath.UserTemplateLogs)
          .doc(template.id)
          .delete();
      } catch (error) {
        alert(error.message);
      }
    },
    [user]
  );

  const startTrainingTemplate = useCallback(
    async (template: TrainingLog) => {
      try {
        const ref = await db
          .collection(DbPath.Users)
          .doc(user?.uid)
          .collection(DbPath.UserLogs)
          .add(template);
        // Causes errors!!
        // await ref.set(
        //   {
        //     timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        //   } as Partial<TrainingLog>,
        //   { merge: true }
        // );
        const activities = (
          await ref.collection(DbPath.UserLogActivities).get()
        ).docs.map(doc => {
          const activity = { ...doc.data(), id: doc.id } as Activity;
          activity.sets = activity.sets.map(set => {
            set.status = ActivityStatus.Unattempted;
            return set;
          });
          return activity;
        });
        console.log('activities is:', activities);
        history.push(`/log/${ref.id}`);
      } catch (error) {
        alert(error.message);
      }
    },
    [user]
  );

  // TODO Re-write in useDataState
  useEffect(() => {
    if (!user) return;
    return db
      .collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        ({ docs }) =>
          setLogs(
            docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog))
          ),
        error => setLogs(DataState.error(error.message))
      );
  }, [user, history]);
  
  useEffect(() => {
    if (!user) return;
    return db
      .collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserTemplateLogs)
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        ({ docs }) => {
          setTemplateLogs(
            docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog))
          );
        },
        error => setTemplateLogs(DataState.error(error.message))
      );
  }, [user, user?.uid]);

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
          onClick={() => auth.signOut()}
          className={css`
            margin-left: auto;
          `}
        >
          Sign Out
        </Button>
      </Rows>
      <Typography variant="h4" color="textSecondary" gutterBottom>
        {user.displayName}
      </Typography>
      <DataStateView
        data={templateLogs}
        loading={() => null}
        error={() => null}
      >
        {templateLogs =>
          !templateLogs.length ? null : (
            <Columns maxWidth>
              <Typography variant="body1" color="textSecondary" gutterBottom>
                Templates
              </Typography>
              <Rows
                pad={Pad.Large}
                maxWidth
                className={css`
                  overflow-x: scroll;
                  padding: ${Pad.Medium} ${Pad.XSmall};
                `}
              >
                {templateLogs.map(template => (
                  <Rows
                    key={template.id}
                    center
                    pad={Pad.Medium}
                    className={css`
                      border-radius: 5px;
                      box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);
                      padding: ${Pad.Small} ${Pad.Large};
                      min-width: min-content;
                    `}
                    onClick={() => startTrainingTemplate(template)}
                  >
                    <Typography variant="body1" color="primary" noWrap>
                      {template.title}
                    </Typography>
                    <IconButton
                      aria-label="Remove template"
                      onClick={() => deleteTemplate(template)}
                      size="small"
                      className={css`
                        margin-left: auto;
                        color: lightgray;
                      `}
                    >
                      <LayersClear />
                    </IconButton>
                  </Rows>
                ))}
              </Rows>
            </Columns>
          )
        }
      </DataStateView>
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Training Logs
      </Typography>
      <DataStateView
        data={logs}
        loading={() => (
          <CenteredContainer>
            <CircularProgress />
          </CenteredContainer>
        )}
        error={() => (
          <CenteredContainer>
            <Typography variant="body2" color="error">
              Something went wrong.
            </Typography>
          </CenteredContainer>
        )}
      >
        {logs => (
          <Columns pad={Pad.Large}>
            {logs.map(log => {
              const logDate = (log.timestamp as firebase.firestore.Timestamp)?.toDate();
              // DoubleArrow FlashOn Layers/LayersClear LibraryAdd/LibraryAddCh
              return (
                <Rows
                  key={log.id}
                  className={css`
                    border-radius: 5px;
                    box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);
                    padding: ${Pad.Large};
                  `}
                >
                  <Columns onClick={() => history.push(`/log/${log.id}`)}>
                    <Typography variant="body1" color="textSecondary">
                      {log.title}
                    </Typography>
                    <Typography variant="body2" color="textPrimary">
                      {format(logDate, `${Format.date} - ${Format.time}`)}
                    </Typography>
                  </Columns>
                  <IconButton
                    aria-label="Add to templates"
                    onClick={() => addTemplate(log)}
                    className={css`
                      margin-left: auto;
                      color: lightgray;
                    `}
                  >
                    <Layers />
                  </IconButton>
                </Rows>
              );
            })}
          </Columns>
        )}
      </DataStateView>
    </Columns>
  );
};

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
import { TrainingTemplate, TrainingLog, Activity } from '../interfaces';
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
  const [templates, setTemplates] = useState<DataState<TrainingTemplate[]>>(
    DataState.Empty
  );

  const history = useHistory();
  const [user] = useUser();

  const addTemplate = useCallback(
    async (log: TrainingLog) => {
      try {
        if (!user) return;
        if (!window.confirm('Create training template from this log?')) return;
        const snapshot = await db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserLogs)
          .doc(log.id)
          .collection(DbPath.UserLogActivities)
          .get();
        const activities = snapshot.docs.map(
          doc => ({ ...doc.data(), id: doc.id } as Activity)
        );
        const newTemplate: Omit<TrainingTemplate, 'id'> = {
          title: log.title,
          activities,
        };
        await db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(DbPath.UserTemplates)
          .add(newTemplate);
        window.scrollTo(window.scrollX, 0);
      } catch (error) {
        alert(error.message);
      }
    },
    [user]
  );

  const deleteTemplate = useCallback(
    (template: TrainingTemplate) => {
      if (!window.confirm(`Remove template? ${template.title}`)) return;
      db.collection(DbPath.Users)
        .doc(user?.uid)
        .collection(DbPath.UserTemplates)
        .doc(template.id)
        .delete()
        .catch(error => {
          alert(error.message);
        });
    },
    [user]
  );

  const startTrainingTemplate = useCallback(
    async (template: TrainingTemplate) => {
      try {
        const newLogFromTemplate: Omit<TrainingLog, 'id'> = {
          title: template.title,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          notes: null,
        };
        const newLogRef = await db
          .collection(DbPath.Users)
          .doc(user?.uid)
          .collection(DbPath.UserLogs)
          .add(newLogFromTemplate);
        const activitiesColl = newLogRef.collection(DbPath.UserLogActivities);
        await Promise.all(template.activities.map(a => activitiesColl.add(a)));
        history.push(`/log/${newLogRef.id}`);
      } catch (error) {
        alert(error.message);
      }
    },
    [user, history]
  );

  // TODO Re-write in useDataState
  useEffect(() => {
    if (!user) return;
    return db
      .collection(DbPath.Users)
      .doc(user.uid)
      .collection(DbPath.UserLogs)
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        ({ docs }) =>
          setLogs(
            docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog))
          ),
        error => setLogs(DataState.error(error.message))
      );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return db
      .collection(DbPath.Users)
      .doc(user.uid)
      .collection(DbPath.UserTemplates)
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        ({ docs }) => {
          const ts = docs.map(
            doc => ({ ...doc.data(), id: doc.id } as TrainingTemplate)
          );
          console.log('ts is:', ts);
          console.log('user.uid is:', user.uid);
          setTemplates(ts);
        },
        error => setTemplates(DataState.error(error.message))
      );
  }, [user]);

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
      <DataStateView data={templates} loading={() => null} error={() => null}>
        {templates =>
          !templates.length ? null : (
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
                {templates.map(template => (
                  <Rows
                    key={template.id}
                    center
                    pad={Pad.Medium}
                    className={css`
                      border-radius: 5px;
                      box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);
                      padding: ${Pad.Small} ${Pad.Medium};
                      min-width: min-content;
                    `}
                    onClick={() => startTrainingTemplate(template)}
                  >
                    <Typography variant="body1" color="textPrimary" noWrap>
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
                    padding: ${Pad.Medium} ${Pad.Large};
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
                    size="medium"
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

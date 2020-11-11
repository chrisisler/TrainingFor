import React, { FC, useCallback, useState, useEffect } from 'react';
import styled from 'styled-components';
import firebase from 'firebase/app';
import { Button, Typography, IconButton, Box } from '@material-ui/core';
import { Close, MoreHoriz, Save } from '@material-ui/icons';

import { Columns, Pad, Rows } from '../style';
import { useUser } from '../useUser';
import { NavBar } from '../components/NavBar';
import {
  TrainingLog,
  Activity,
  ActivitySet,
  ActivityStatus,
} from '../interfaces';
import { db, DbPath } from '../firebase';
import { DataState, DataStateView, useDataState } from '../DataState';
import { useParams, useHistory } from 'react-router-dom';

const StartTrainingContainer = styled.div`
  height: 100vh;
  width: 100%;
  display: grid;
  place-items: center;
`;

const AddTrainingContainer = styled(Columns)`
  padding: 0 ${Pad.Large};
`;

const AddActivityContainer = styled(Rows)`
  width: 100%;
`;

const AddActivityInput = styled.input.attrs(() => ({
  type: 'text',
}))`
  box-sizing: content-box;
  width: 100%;
  padding: ${Pad.Medium};
  border: 1px solid lightgray;
  border-radius: 3px;
  font-size: 1em;
`;

const AddTrainingHeader = styled.nav`
  display: flex;
  width: 100%;
  padding: ${Pad.XSmall} ${Pad.Medium};
  justify-content: flex-end;
`;

export const StartTraining: FC = () => {
  const [activityName, setActivityName] = useState<string>('');

  const history = useHistory();
  const [user] = useUser();
  const { logId } = useParams<{ logId?: string }>();

  const [logDoc, setLogDoc] = useDataState(
    async () =>
      logId
        ? (db
            .collection(DbPath.Users)
            .doc(user?.uid)
            .collection(DbPath.UserLogs)
            .doc(logId) as firebase.firestore.DocumentReference<TrainingLog>)
        : DataState.Empty,
    [logId, user?.uid]
  );

  const addLog = useCallback(() => {
    const newLog: Omit<TrainingLog, 'id'> = {
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      activities: [],
      notes: null,
    };
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .add(newLog)
      .then(docRef => {
        setLogDoc(docRef as firebase.firestore.DocumentReference<TrainingLog>);
      })
      .catch(error => {
        setLogDoc(DataState.error(error.message));
        alert(error.message);
      });
  }, [user?.uid, setLogDoc]);

  const addActivity = useCallback(
    <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      const newActivity: Omit<Activity, 'id'> = {
        name: activityName,
        notes: null,
        sets: [],
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
      db.collection(DbPath.Users)
        .doc(user?.uid)
        .collection(DbPath.UserLogs)
        .doc(DataState.isReady(logDoc) ? logDoc.id : undefined)
        .collection(DbPath.UserLogActivities)
        .doc()
        .set(newActivity)
        .catch(error => {
          alert(error.message);
        });
      setActivityName('');
    },
    [activityName, user?.uid, logDoc]
  );

  const deleteLogDoc = useCallback(() => {
    if (!window.confirm('Cancel training?')) return;
    if (!DataState.isReady(logDoc)) return;
    setLogDoc(DataState.Loading);
    logDoc
      .delete()
      .then(() => {
        setLogDoc(DataState.Empty);
      })
      .catch(error => {
        setLogDoc(DataState.error(error.message));
        alert(error.message);
      });
  }, [logDoc, setLogDoc]);

  return (
    <>
      <DataStateView
        data={logDoc}
        empty={() => (
          <StartTrainingContainer>
            <Columns pad={Pad.Large}>
              <Typography variant="h4" color="textPrimary">
                Start Training
              </Typography>
              <Button variant="contained" color="primary" onClick={addLog}>
                Go
              </Button>
            </Columns>
          </StartTrainingContainer>
        )}
        error={() => (
          <Typography variant="h4" color="textPrimary">
            Error
          </Typography>
        )}
        loading={() => (
          <Typography variant="h4" color="textPrimary">
            Loading
          </Typography>
        )}
      >
        {logDoc => (
          <Columns>
            <AddTrainingHeader>
              <IconButton
                aria-label="Finish Training"
                onClick={() => {
                  if (logId) history.push('/');
                  setLogDoc(DataState.Empty);
                }}
              >
                <Save />
              </IconButton>
              {!logId && (
                <IconButton
                  aria-label="Delete Training Log"
                  onClick={deleteLogDoc}
                >
                  <Close />
                </IconButton>
              )}
            </AddTrainingHeader>
            <Columns>
              <AddTrainingContainer pad={Pad.Medium}>
                <Typography variant="body1" color="textPrimary">
                  {/** Date */}
                  Thu, Sep 17
                  <br />
                  2:20 PM
                </Typography>
                <AddActivityContainer as="form" onSubmit={addActivity}>
                  <AddActivityInput
                    placeholder="Enter activity"
                    value={activityName}
                    onChange={event => setActivityName(event.target.value)}
                  />
                  {activityName.length > 0 && (
                    <Button
                      variant="outlined"
                      color="primary"
                      style={{ margin: `0 0 0 ${Pad.Medium}` }}
                      onClick={addActivity}
                    >
                      Add
                    </Button>
                  )}
                </AddActivityContainer>
              </AddTrainingContainer>
              <ActivitiesView logId={logDoc.id} />
            </Columns>
          </Columns>
        )}
      </DataStateView>
      <NavBar />
    </>
  );
};

const ActivityViewContainer = styled(Columns)`
  width: 100%;
  border-bottom: 1px solid lightgray;
  padding: ${Pad.Medium} ${Pad.Small} ${Pad.Medium} ${Pad.Large};
`;

// TODO flex end
const ActivityStatusButton = styled.button`
  font-size: 0.7em;
  color: lightgray;
  border: 0;
  font-weight: 800;
  background-color: transparent;
  text-transform: uppercase;
  outline: none;
`;

const ActivitiesListContainer = styled.div`
  /** TODO height */
  height: 65vh;
  width: 100%;
  overflow-y: scroll;
`;

const ActivitiesView: FC<{
  logId: string;
}> = ({ logId }) => {
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Empty
  );

  const [user] = useUser();

  useEffect(() => {
    return db
      .collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        snapshot =>
          setActivities(
            snapshot.docs.map(
              doc => ({ ...doc.data(), id: doc.id } as Activity)
            )
          ),
        error => setActivities(DataState.error(error.message))
      );
  }, [user?.uid, logId]);

  return (
    <DataStateView data={activities} error={() => null} loading={() => null}>
      {activities => (
        <ActivitiesListContainer>
          {activities.map(activity => (
            <ActivityViewContainer key={activity.id}>
              <Rows maxWidth center between padding={`${Pad.Small} 0`}>
                <Typography variant="subtitle1" color="textPrimary">
                  {activity.name}
                </Typography>
                <Box minHeight="min-content">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const newSet: Omit<ActivitySet, 'id'> = {
                        name: `Set ${activity.sets.length + 1}`,
                        repCount: null,
                        notes: null,
                        status: ActivityStatus.Unattempted,
                      };
                      db.collection(DbPath.Users)
                        .doc(user?.uid)
                        .collection(DbPath.UserLogs)
                        .doc(logId)
                        .collection(DbPath.UserLogActivities)
                        .doc(activity.id)
                        .update({
                          sets: firebase.firestore.FieldValue.arrayUnion(
                            newSet
                          ),
                        })
                        .catch(error => {
                          alert(error.message);
                        });
                    }}
                  >
                    +
                  </Button>
                  <IconButton
                    aria-label="Remove activity"
                    onClick={() => {
                      db.collection(DbPath.Users)
                        .doc(user?.uid)
                        .collection(DbPath.UserLogs)
                        .doc(logId)
                        .collection(DbPath.UserLogActivities)
                        .doc(activity.id)
                        .delete()
                        .catch(error => {
                          alert(error.message);
                        });
                    }}
                  >
                    <MoreHoriz />
                  </IconButton>
                </Box>
              </Rows>
              {activity.sets.map(({ name, repCount, status }, index, sets) => (
                <Rows
                  key={index}
                  maxWidth
                  center
                  padding={`0 ${Pad.Medium}`}
                  between
                >
                  <Typography variant="subtitle2" color="textSecondary">
                    {name}
                  </Typography>
                  <p>{repCount}</p>
                  <ActivityStatusButton
                    onClick={() => {
                      sets[index].status = Activity.cycleStatus(status);
                      db.collection(DbPath.Users)
                        .doc(user?.uid)
                        .collection(DbPath.UserLogs)
                        .doc(logId)
                        .collection(DbPath.UserLogActivities)
                        .doc(activity.id)
                        .set({ sets }, { merge: true })
                        .catch(error => {
                          alert(error.message);
                        });
                    }}
                  >
                    {status}
                  </ActivityStatusButton>
                </Rows>
              ))}
            </ActivityViewContainer>
          ))}
        </ActivitiesListContainer>
      )}
    </DataStateView>
  );
};

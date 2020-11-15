import React, { FC, useCallback, useState, useEffect } from 'react';
import styled from 'styled-components';
import firebase from 'firebase/app';
import {
  Button,
  Typography,
  IconButton,
  CircularProgress,
  MenuItem,
  Menu,
  ClickAwayListener,
} from '@material-ui/core';
import { Close, MoreHoriz, Save, FiberManualRecord } from '@material-ui/icons';
import { useParams, useHistory } from 'react-router-dom';
import format from 'date-fns/format';
import { v4 as uuid } from 'uuid';

import { Columns, Pad, Rows } from '../style';
import { useUser } from '../useUser';
import {
  TrainingLog,
  Activity,
  ActivitySet,
  ActivityStatus,
} from '../interfaces';
import { db, DbPath } from '../firebase';
import { DataState, DataStateView, useDataState } from '../DataState';

const StartTrainingContainer = styled.div`
  height: 100%;
  width: 100%;
  display: grid;
  place-items: center;
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

  // TODO Causes errors sometimes due to `logId` being void or `logDoc` being
  // void
  const [logDoc, setLogDoc] = useDataState(
    async () =>
      !!logId
        ? (db
            .collection(DbPath.Users)
            .doc(user?.uid)
            .collection(DbPath.UserLogs)
            .doc(logId) as firebase.firestore.DocumentReference<TrainingLog>)
        : DataState.Empty,
    [logId, user?.uid]
  );

  const [logDate] = useDataState<undefined | Date>(
    async () =>
      !DataState.isReady(logDoc)
        ? DataState.Empty
        : logDoc.get().then(doc => doc.get('timestamp')?.toDate()),
    [logDoc]
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
        console.log('error is:', error);
        alert(error.message);
        setLogDoc(DataState.error(error.message));
      });
  }, [user?.uid, setLogDoc]);

  const addActivity = useCallback(
    <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!activityName.length) return;
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
    if (!window.confirm('Delete this training log forever?')) return;
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
        <>
          <AddTrainingHeader>
            <IconButton
              aria-label="Finish Training"
              onClick={() => {
                setLogDoc(DataState.Empty);
                if (logId) history.push('/');
              }}
            >
              <Save />
            </IconButton>
            <IconButton aria-label="Delete Training Log" onClick={deleteLogDoc}>
              <Close />
            </IconButton>
          </AddTrainingHeader>
          <Columns style={{ height: '100%' }}>
            <Columns pad={Pad.Medium} padding={`0 ${Pad.Large}`}>
              <DataStateView
                data={logDate}
                error={() => null}
                loading={() => (
                  <Columns maxWidth between>
                    <CircularProgress />
                  </Columns>
                )}
              >
                {logDate =>
                  !logDate ? null : (
                    <Typography variant="body1" color="textPrimary">
                      {format(logDate, 'EEE MMM d')}
                      <br />
                      {format(logDate, 'h:mm a')}
                    </Typography>
                  )
                }
              </DataStateView>
              <Rows maxWidth as="form" onSubmit={addActivity}>
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
              </Rows>
            </Columns>
            <ActivitiesView logId={logDoc.id} />
          </Columns>
        </>
      )}
    </DataStateView>
  );
};

const ActivityViewContainer = styled(Columns)`
  width: 100%;
  /* border-top: 1px solid lightgray; */
  padding: ${Pad.Medium} ${Pad.Small} ${Pad.Small} ${Pad.Large};
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
  height: 100%;
  width: 100%;
  overflow-y: scroll;
`;

const ActivitiesView: FC<{ logId: string }> = ({ logId }) => {
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
          {activities.map(a => (
            <ActivityView key={a.id} logId={logId} activity={a} />
          ))}
        </ActivitiesListContainer>
      )}
    </DataStateView>
  );
};

const ActivityView: FC<{
  logId: string;
  activity: Activity;
}> = ({ logId, activity }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openActivityMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const closeActivityMenu = () => setAnchorEl(null);

  const [user] = useUser();

  const addSet = () => {
    const newSet: ActivitySet = {
      uuid: uuid(),
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
        sets: firebase.firestore.FieldValue.arrayUnion(newSet),
      })
      .catch(error => {
        alert(error.message);
      });
  };

  const deleteActivity = () => {
    closeActivityMenu();
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
  };

  const renameActivity = () => {
    closeActivityMenu();
    const newName = window.prompt('Update activity name');
    if (!newName) return;
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .doc(activity.id)
      .set({ name: newName }, { merge: true })
      .catch(error => {
        alert(error.message);
      });
  };

  return (
    <ActivityViewContainer key={activity.id}>
      <Rows maxWidth center between padding={`${Pad.Small} 0`}>
        <Typography variant="subtitle1" color="textPrimary">
          {activity.name}
        </Typography>
        <Rows center>
          <Button
            style={{ height: 'min-content' }}
            variant="outlined"
            size="small"
            onClick={addSet}
          >
            +
          </Button>
          <ClickAwayListener onClickAway={closeActivityMenu}>
            <div>
              <IconButton
                aria-label="Open activity menu"
                aria-controls="activity-menu"
                aria-haspopup="true"
                onClick={openActivityMenu}
              >
                <FiberManualRecord
                  fontSize="small"
                  style={{ color: 'lightgray' }}
                />
              </IconButton>
              <Menu
                id="activity-menu"
                keepMounted
                anchorEl={anchorEl}
                open={!!anchorEl}
                onClose={closeActivityMenu}
                MenuListProps={{ dense: true }}
              >
                <MenuItem onClick={renameActivity}>Rename activity</MenuItem>
                <MenuItem onClick={deleteActivity}>Delete activity</MenuItem>
              </Menu>
            </div>
          </ClickAwayListener>
        </Rows>
      </Rows>
      {activity.sets.map(({ uuid }, index, sets) => (
        <ActivitySetView
          key={uuid}
          index={index}
          sets={sets}
          logId={logId}
          activityId={activity.id}
        />
      ))}
    </ActivityViewContainer>
  );
};

const ActivitySetView: FC<{
  index: number;
  sets: ActivitySet[];
  logId: string;
  activityId: string;
}> = ({ index, sets, logId, activityId }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openSetMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const closeSetMenu = () => setAnchorEl(null);

  const [user] = useUser();

  const set = sets[index];

  const cycleSetStatus = () => {
    sets[index].status = Activity.cycleStatus(set.status);
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .doc(activityId)
      .set({ sets }, { merge: true })
      .catch(error => {
        alert(error.message);
      });
  };

  const duplicateSet = () => {
    closeSetMenu();
    const duplicateSet = {
      ...sets[index],
      uuid: uuid(),
      notes: null,
      status: ActivityStatus.Unattempted,
    };
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .doc(activityId)
      .update({
        sets: firebase.firestore.FieldValue.arrayUnion(duplicateSet),
      })
      .catch(error => {
        alert(error.message);
      });
  };

  const deleteSet = () => {
    closeSetMenu();
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .doc(activityId)
      .update({
        sets: firebase.firestore.FieldValue.arrayRemove(set),
      })
      .catch(error => {
        alert(error.message);
      });
  };

  const renameSet = () => {
    closeSetMenu();
    const newName = window.prompt('Update set name');
    if (!newName) return;
    sets[index].name = newName;
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .doc(activityId)
      .set({ sets }, { merge: true })
      .catch(error => {
        alert(error.message);
      });
  };

  return (
    <Rows maxWidth center padding={`0 ${Pad.Small}`} between>
      <Rows center pad={Pad.Small}>
        <Typography variant="subtitle1" style={{ color: 'lightgray' }}>
          #{index + 1}
        </Typography>
        <Typography variant="subtitle2" color="textSecondary">
          {set.name}
        </Typography>
      </Rows>
      <p>{set.repCount}</p>
      <Rows center>
        <ActivityStatusButton onClick={cycleSetStatus}>
          {set.status}
        </ActivityStatusButton>
        <ClickAwayListener onClickAway={closeSetMenu}>
          <div>
            <IconButton
              size="small"
              aria-label="Open set menu"
              aria-controls="set-menu"
              aria-haspopup="true"
              onClick={openSetMenu}
            >
              <MoreHoriz fontSize="small" style={{ color: 'lightgray' }} />
            </IconButton>
            <Menu
              id="set-menu"
              keepMounted
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={closeSetMenu}
              MenuListProps={{ dense: true }}
            >
              <MenuItem onClick={duplicateSet}>Duplicate set</MenuItem>
              <MenuItem onClick={renameSet}>Rename set</MenuItem>
              <MenuItem onClick={deleteSet}>
                <strong>Delete set</strong>
              </MenuItem>
            </Menu>
          </div>
        </ClickAwayListener>
      </Rows>
    </Rows>
  );
};

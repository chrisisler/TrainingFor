import React, { FC, useCallback, useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/css';
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
import { DeleteOutline, MoreHoriz, Done } from '@material-ui/icons';
import { useParams, useHistory } from 'react-router-dom';
import format from 'date-fns/format';
import { v4 as uuid } from 'uuid';
import FlipMove from 'react-flip-move';

import { Columns, Pad, Rows } from '../style';
import { useUser } from '../useUser';
import {
  TrainingLog,
  Activity,
  ActivitySet,
  ActivityStatus,
} from '../interfaces';
import { db, DbPath } from '../firebase';
import { DataState, DataStateView } from '../DataState';
import { Format } from '../constants';

const AddActivityInput = styled.input`
  box-sizing: content-box;
  width: 100%;
  padding: ${Pad.Medium};
  border: 1px solid lightgray;
  border-radius: 3px;
  font-size: 1em;
`;

export const StartTraining: FC = () => {
  const [activityName, setActivityName] = useState<string>('');

  const history = useHistory();
  const [user] = useUser();
  const { logId } = useParams<{ logId?: string }>();

  const [logDoc, setLogDoc] = useState<
    DataState<firebase.firestore.DocumentSnapshot<TrainingLog>>
  >(DataState.Empty);

  const logDate = DataState.map(logDoc, _ =>
    _ ? (_.data()?.timestamp as firebase.firestore.Timestamp)?.toDate() : null
  );

  // Subscribe to updates to the TrainingLog ID from the URL
  useEffect(() => {
    if (!logId || !user) return;
    return db
      .collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .onSnapshot(
        s => {
          setLogDoc(s as firebase.firestore.DocumentSnapshot<TrainingLog>);
        },
        err => setLogDoc(DataState.error(err.message))
      );
  }, [logId, user]);

  const exitTraining = useCallback(() => {
    setLogDoc(DataState.Empty);
    if (window.location.pathname !== '/') history.push('/');
  }, [setLogDoc, history]);

  const renameLog = useCallback(() => {
    // TODO logTitle default
    const newTitle = window.prompt('Update training log title');
    if (!newTitle) return;
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .set({ title: newTitle } as Partial<TrainingLog>, { merge: true })
      .catch(error => {
        alert(error.message);
      });
  }, [user?.uid, logId]);

  const addActivity = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      try {
        event.preventDefault();
        if (!activityName.length) return;
        setActivityName('');
        // Look to the previous activity to determine the position
        // number of the activity being added
        // TODO Combine ActivitiesListView into this so we can
        // use `activities` array from use effect instead of hitting DB
        const prevMaxPosition = await db
          .collection(DbPath.Users)
          .doc(user?.uid)
          .collection(DbPath.UserLogs)
          .doc(DataState.isReady(logDoc) ? logDoc.id : undefined)
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
        };
        db.collection(DbPath.Users)
          .doc(user?.uid)
          .collection(DbPath.UserLogs)
          .doc(DataState.isReady(logDoc) ? logDoc.id : undefined)
          .collection(DbPath.UserLogActivities)
          .add(newActivity);
      } catch (error) {
        alert(error.message);
      }
    },
    [activityName, user?.uid, logDoc]
  );

  const deleteLogDoc = useCallback(() => {
    if (!DataState.isReady(logDoc)) return;
    if (!window.confirm('Delete this training log forever?')) return;
    setLogDoc(DataState.Loading);
    logDoc.ref
      .delete()
      .catch(error => {
        setLogDoc(DataState.error(error.message));
        alert(error.message);
      })
      .finally(() => {
        history.push('/account');
      });
  }, [logDoc, setLogDoc, history]);

  if (!logId) return null;

  return (
    <DataStateView
      data={logDoc}
      error={() => (
        <Typography variant="h4" color="textPrimary">
          Error
        </Typography>
      )}
      loading={() => <CircularProgress />}
    >
      {logDoc => (
        <Columns
          className={css`
            height: 100%;
          `}
        >
          <Rows between center maxWidth padding={`0 ${Pad.Medium}`}>
            <IconButton aria-label="Exit training" onClick={exitTraining}>
              {/**
               * TODO if previous url was /account page then make the icon the
               * back arrow, otherwise make the icon Done.
               */}
              <Done color="primary" />
            </IconButton>
            <IconButton aria-label="Edit log name" onClick={renameLog}>
              <Typography variant="subtitle1" color="textSecondary">
                {DataState.isReady(logDoc) && logDoc.data()?.title}
              </Typography>
            </IconButton>
            <IconButton aria-label="Delete training log" onClick={deleteLogDoc}>
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
                    margin: 0 0 0 ${Pad.Medium};
                  `}
                  onClick={addActivity}
                >
                  Add
                </Button>
              )}
            </Rows>
          </Columns>
          <ActivitiesListView />
        </Columns>
      )}
    </DataStateView>
  );
};

const ActivityViewContainer = styled(Columns)`
  width: 100%;
  padding: ${Pad.Small} ${Pad.Small} ${Pad.Small} ${Pad.Large};
`;

const ActivityStatusButton = styled.button`
  color: lightgray;
  font-size: 0.72em;
  border: 0;
  border-left: 1px solid
    ${(props: { status: ActivityStatus }) => {
      if (props.status === ActivityStatus.Unattempted) return 'lightgray';
      if (props.status === ActivityStatus.Completed) return 'green';
      if (props.status === ActivityStatus.Skipped) return 'orange';
      if (props.status === ActivityStatus.Injured) return 'red';
      throw Error('Unreachable');
    }};
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

const ActivitiesListView: FC = () => {
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Empty
  );

  const [user] = useUser();
  const { logId } = useParams<{ logId?: string }>();

  useEffect(() => {
    return db
      .collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .orderBy('position', 'desc')
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
    <DataStateView
      data={activities}
      error={() => null}
      loading={() => (
        <Columns maxWidth between>
          <CircularProgress />
        </Columns>
      )}
    >
      {activities => (
        <ActivitiesListContainer>
          <FlipMove enterAnimation="fade" leaveAnimation="fade">
            {activities.map(({ id }, index) => (
              <FlipMoveChild key={id}>
                <ActivityView activities={activities} index={index} />
              </FlipMoveChild>
            ))}
          </FlipMove>
        </ActivitiesListContainer>
      )}
    </DataStateView>
  );
};

const FlipMoveChild = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>((props, ref) => <div ref={ref}>{props.children}</div>);

const ActivityView: FC<{ activities: Activity[]; index: number }> = ({
  activities,
  index,
}) => {
  const activity = activities[index];
  const [notes, setNotes] = useState<string>(activity.notes ?? '');

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openActivityMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const closeActivityMenu = () => setAnchorEl(null);

  const [user] = useUser();
  const { logId } = useParams<{ logId?: string }>();

  const addSet = () => {
    const newSet: ActivitySet = {
      uuid: uuid(),
      name: `Set ${activity.sets.length + 1}`,
      notes: null,
      weight: activity.sets?.[0]?.weight ?? 0,
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
    const newName = window.prompt('Update activity name', activity.name);
    if (!newName) return;
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .doc(activity.id)
      .set({ name: newName } as Partial<Activity>, { merge: true })
      .catch(error => {
        alert(error.message);
      });
  };

  const moveActivityUp = async () => {
    closeActivityMenu();
    if (activities.length === 1 || index === 0) return;
    try {
      const batch = db.batch();
      const activitiesColl = db
        .collection(DbPath.Users)
        .doc(user?.uid)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .collection(DbPath.UserLogActivities);
      const otherDocRef = activitiesColl.doc(activities[index - 1].id);
      const swapped = (await otherDocRef.get()).get('position') as number;
      batch.update(activitiesColl.doc(activity.id), {
        position: swapped,
      } as Partial<Activity>);
      batch.update(otherDocRef, {
        position: activity.position,
      } as Partial<Activity>);
      await batch.commit();
    } catch (error) {
      alert(error.message);
    }
  };

  const moveActivityDown = async () => {
    closeActivityMenu();
    if (activities.length === 1 || index + 1 === activities.length) return;
    try {
      const batch = db.batch();
      const activitiesColl = db
        .collection(DbPath.Users)
        .doc(user?.uid)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .collection(DbPath.UserLogActivities);
      const otherDocRef = activitiesColl.doc(activities[index + 1].id);
      const swapped = (await otherDocRef.get()).get('position') as number;
      batch.update(activitiesColl.doc(activity.id), {
        position: swapped,
      } as Partial<Activity>);
      batch.update(otherDocRef, {
        position: activity.position,
      } as Partial<Activity>);
      await batch.commit();
    } catch (error) {
      alert(error.message);
    }
  };

  const updateActivityNotes = async () => {
    try {
      db.collection(DbPath.Users)
        .doc(user?.uid)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .collection(DbPath.UserLogActivities)
        .doc(activity.id)
        .update({ notes: notes } as Partial<Activity>);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <ActivityViewContainer key={activity.id}>
      <Rows maxWidth center between>
        <Typography variant="subtitle1" color="textPrimary">
          {activity.name}
        </Typography>
        <Rows center>
          <Button
            variant="contained"
            color="primary"
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
                <MoreHoriz
                  className={css`
                    color: lightgray;
                  `}
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
                <MenuItem
                  onClick={moveActivityUp}
                  disabled={activities.length === 1 || index === 0}
                >
                  Move up
                </MenuItem>
                <MenuItem
                  onClick={moveActivityDown}
                  disabled={
                    activities.length === 1 || index + 1 === activities.length
                  }
                >
                  Move down
                </MenuItem>
                <MenuItem onClick={renameActivity}>Rename activity</MenuItem>
                <MenuItem onClick={deleteActivity}>Delete activity</MenuItem>
              </Menu>
            </div>
          </ClickAwayListener>
        </Rows>
      </Rows>
      <input
        type="text"
        name="notes"
        placeholder="Notes..."
        value={notes}
        onChange={event => setNotes(event.target.value)}
        onBlur={updateActivityNotes}
        className={css`
          width: 80%;
          font-size: 0.85em;
          border: 0;
          padding: ${Pad.Small};
        `}
      />
      <FlipMove enterAnimation="fade" leaveAnimation="fade">
        {activity.sets.map(({ uuid }, index) => (
          <FlipMoveChild key={uuid}>
            <ActivitySetView
              index={index}
              sets={activity.sets}
              activityId={activity.id}
            />
          </FlipMoveChild>
        ))}
      </FlipMove>
    </ActivityViewContainer>
  );
};

const ActivitySetView: FC<{
  index: number;
  sets: ActivitySet[];
  activityId: string;
}> = ({ index, sets, activityId }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openSetMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const closeSetMenu = () => setAnchorEl(null);

  const [user] = useUser();
  const { logId } = useParams<{ logId?: string }>();

  /** The ActivitySet this ActivitySetView is rendering. */
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

  /** Duplicate this set, except for its ActivityStatus. */
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
    const newName = window.prompt('Update set name', set.name);
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

  const updateSetWeight = (event: React.ChangeEvent<HTMLInputElement>) => {
    sets[index].weight = Number(event.target.value);
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
        <Typography
          variant="subtitle1"
          className={css`
            color: lightgray;
          `}
        >
          #{index + 1}
        </Typography>
        <Typography variant="subtitle2" color="textSecondary">
          {set.name}
        </Typography>
      </Rows>
      <Rows center pad={Pad.XSmall}>
        <input
          type="number"
          name="weight"
          value={set.weight}
          onInput={event => {
            // Limit input length to 3
            const input = event.currentTarget;
            if (input.value.length > 3) input.value = input.value.slice(0, 3);
          }}
          onChange={updateSetWeight}
          className={css`
            width: 5ch;
            color: gray;
            border: 0;
            font-family: monospace;
            text-align: center;
          `}
        />
        <ActivityStatusButton status={set.status} onClick={cycleSetStatus}>
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
              <MoreHoriz
                className={css`
                  color: lightgray;
                `}
              />
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

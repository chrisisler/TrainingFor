import React, { FC, useState, useEffect, useRef, useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/css';
import {
  Typography,
  Button,
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
} from '@material-ui/core';
import { MoreHoriz } from '@material-ui/icons';
import firebase from 'firebase/app';
import FlipMove from 'react-flip-move';
import { v4 as uuid } from 'uuid';

import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbPath } from '../firebase';
import { Activity, ActivityStatus, ActivitySet } from '../interfaces';
import { Columns, Pad, Rows } from '../style';

const ActivityStatusButton = styled.button`
  color: lightgray;
  font-size: 0.72em;
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

const FlipMoveChild = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>((props, ref) => <div ref={ref}>{props.children}</div>);

const ActivityNotesTextarea = styled.textarea`
  display: ${(props: { notes: Activity['notes'] }) =>
    props.notes === null ? 'none' : 'block'};
`;

export const TrainingLogEditorView: FC<{
  logAuthorId: string;
  logId: string;
}> = ({ logAuthorId, logId }) => {
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Loading
  );

  useEffect(() => {
    return db
      .collection(DbPath.Users)
      .doc(logAuthorId)
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
  }, [logAuthorId, logId]);

  return (
    <DataStateView data={activities} error={() => null}>
      {activities => (
        <ActivitiesListContainer>
          <FlipMove enterAnimation="fade" leaveAnimation="fade">
            {activities.map(({ id }, index) => (
              <FlipMoveChild key={id}>
                <ActivityView
                  editable
                  activities={activities}
                  index={index}
                  logId={logId}
                  logAuthorId={logAuthorId}
                />
              </FlipMoveChild>
            ))}
          </FlipMove>
        </ActivitiesListContainer>
      )}
    </DataStateView>
  );
};

export const TrainingLogView: FC<{
  logAuthorId: string;
  logId: string;
}> = ({ logAuthorId, logId }) => {
  const [activities] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(logAuthorId)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .collection(DbPath.UserLogActivities)
        // .orderBy('position', 'desc')
        .get()
        .then(snapshot =>
          snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Activity))
        ),

    [logAuthorId, logId]
  );

  return (
    <DataStateView data={activities} error={() => null}>
      {activities => (
        <div
          className={css`
            border-bottom: 1px solid lightgray;
          `}
        >
          {activities.map(({ id }, index) => (
            <ActivityView
              key={id}
              activities={activities}
              index={index}
              editable={false}
              logId={logId}
              logAuthorId={logAuthorId}
            />
          ))}
        </div>
      )}
    </DataStateView>
  );
};

const ActivityView: FC<{
  /**
   * Caution! Providing the wrong value can break the entire app at runtime.
   */
  editable: boolean;
  activities: Activity[];
  index: number;
  logId: string;
  logAuthorId: string;
}> = ({ activities, index, editable, logId, logAuthorId }) => {
  const activity = activities[index];
  const [notes, setNotes] = useState<Activity['notes']>(activity.notes);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openActivityMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const closeActivityMenu = () => setAnchorEl(null);

  const [pressHoldButtonRef] = usePressHoldRef(() =>
    addActivitySet(ActivityStatus.Completed)
  );

  const addActivitySet = (status?: ActivityStatus) => {
    const weight = activity.sets[activity.sets.length - 1]?.weight ?? 0;
    const newSet: ActivitySet = {
      uuid: uuid(),
      name: `Set ${activity.sets.length + 1}`,
      notes: null,
      weight,
      status: status ?? ActivityStatus.Unattempted,
    };
    db.collection(DbPath.Users)
      .doc(logAuthorId)
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
      .doc(logAuthorId)
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
      .doc(logAuthorId)
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
        .doc(logAuthorId)
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
        .doc(logAuthorId)
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
    // Hide notes if user set value to empty string
    const nullIfEmpty = notes === '' ? null : notes;
    setNotes(nullIfEmpty);
    try {
      db.collection(DbPath.Users)
        .doc(logAuthorId)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .collection(DbPath.UserLogActivities)
        .doc(activity.id)
        .update({ notes: nullIfEmpty } as Partial<Activity>);
    } catch (error) {
      alert(error.message);
    }
  };

  const addActivityNotes = () => {
    closeActivityMenu();
    if (notes) return;
    // Make the notes textarea visible. See <ActivityNotesTextarea />
    setNotes('');
    // Wait for the event loop to render the element so we can focus it
    Promise.resolve().then(() => notesRef.current?.focus());
  };

  return (
    <Columns maxWidth padding={`0 ${Pad.Small} 0 ${Pad.Large}`}>
      <Rows maxWidth center between>
        <Typography variant="subtitle1" color="textPrimary" gutterBottom>
          {activity.name}
        </Typography>
        {editable && (
          <Rows center>
            <Button
              ref={editable ? pressHoldButtonRef : undefined}
              disabled={!editable}
              variant="contained"
              color="primary"
              size="small"
              onClick={() => addActivitySet()}
            >
              +
            </Button>
            <ClickAwayListener onClickAway={closeActivityMenu}>
              <div>
                <IconButton
                  disabled={!editable}
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
                  {!notes && (
                    <MenuItem onClick={addActivityNotes}>Add notes</MenuItem>
                  )}
                  <MenuItem onClick={renameActivity}>Rename activity</MenuItem>
                  <MenuItem onClick={deleteActivity}>Delete activity</MenuItem>
                </Menu>
              </div>
            </ClickAwayListener>
          </Rows>
        )}
      </Rows>
      <ActivityNotesTextarea
        disabled={!editable}
        notes={notes}
        name="notes"
        placeholder="Notes"
        ref={notesRef}
        rows={2}
        maxLength={140}
        onChange={event => setNotes(event.target.value)}
        onBlur={updateActivityNotes}
        className={css`
          width: 90%;
          color: gray;
          border: 0;
          padding: 0 ${Pad.XSmall};
          resize: none;
          font-size: 0.8em;
          font-style: italic;
          font-family: inherit;
        `}
        value={notes ?? ''}
      />
      <FlipMove enterAnimation="fade" leaveAnimation="fade">
        {activity.sets.map(({ uuid }, index) => (
          <FlipMoveChild key={uuid}>
            <ActivitySetView
              index={index}
              sets={activity.sets}
              activityId={activity.id}
              editable={editable}
              logAuthorId={logAuthorId}
              logId={logId}
            />
          </FlipMoveChild>
        ))}
      </FlipMove>
    </Columns>
  );
};

const ActivitySetView: FC<{
  index: number;
  sets: ActivitySet[];
  activityId: string;
  editable: boolean;
  logAuthorId: string;
  logId: string;
}> = ({ index, sets, activityId, editable, logAuthorId, logId }) => {
  const set = sets[index];
  const [weight, setWeight] = useState(set.weight);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openSetMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const closeSetMenu = () => setAnchorEl(null);

  const cycleSetStatus = () => {
    sets[index].status = Activity.cycleStatus(set.status);
    db.collection(DbPath.Users)
      .doc(logAuthorId)
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
      .doc(logAuthorId)
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
      .doc(logAuthorId)
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
      .doc(logAuthorId)
      .collection(DbPath.UserLogs)
      .doc(logId)
      .collection(DbPath.UserLogActivities)
      .doc(activityId)
      .set({ sets }, { merge: true })
      .catch(error => {
        alert(error.message);
      });
  };

  /** Modify `sets` in-place, updating the weight of the current set. */
  const updateSetWeight = (event: React.ChangeEvent<HTMLInputElement>) => {
    sets[index].weight = Number(event.target.value);
    db.collection(DbPath.Users)
      .doc(logAuthorId)
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
          disabled={!editable}
          type="tel"
          min={0}
          max={999}
          maxLength={3}
          name="weight"
          value={weight}
          onChange={event => {
            if (Number.isNaN(event.target.value)) return;
            setWeight(Number(event.target.value));
          }}
          onBlur={updateSetWeight}
          className={css`
            background-color: transparent;
            width: 5ch;
            color: gray;
            border: 0;
            font-family: monospace;
            text-align: center;
          `}
        />
        <ActivityStatusButton disabled={!editable} onClick={cycleSetStatus}>
          {set.status}
        </ActivityStatusButton>
        <ClickAwayListener onClickAway={closeSetMenu}>
          <div>
            <IconButton
              disabled={!editable}
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

/**
 * From https://www.kirupa.com/html5/press_and_hold.htm
 *
 * Provides a ref enabling buttons to listen to press hold events.
 */
const usePressHoldRef = (
  onPressHold: () => void
): [React.MutableRefObject<HTMLButtonElement | null>] => {
  const ref = useRef<HTMLButtonElement | null>(null);

  const timerId = useRef<number | null>(null);
  const tickCounter = useRef(0);

  // Count ticks at 60fps until duration is satisfied, then invoke.
  const onTick = useCallback(() => {
    if (tickCounter.current < 60) {
      timerId.current = requestAnimationFrame(onTick);
      tickCounter.current++;
    } else {
      if (tickCounter.current === -1) return;
      onPressHold();
    }
  }, [timerId, onPressHold]);

  const startHoldTimer = useCallback(
    (event: Event) => {
      requestAnimationFrame(onTick);
      event.preventDefault();
      tickCounter.current = 0;
    },
    [onTick]
  );

  const stopHoldTimer = useCallback(() => {
    if (timerId.current) cancelAnimationFrame(timerId.current);
    // If held for small amount of time, assume click and signal to stop
    if (tickCounter.current < 20) {
      ref.current?.click();
    } else {
      tickCounter.current = -1;
    }
  }, [timerId]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.addEventListener('mousedown', startHoldTimer, false);
    node.addEventListener('mouseup', stopHoldTimer, false);
    node.addEventListener('mouseleave', stopHoldTimer, false);
    node.addEventListener('touchstart', startHoldTimer, false);
    node.addEventListener('touchend', stopHoldTimer, false);
    return () => {
      node.removeEventListener('mousedown', startHoldTimer);
      node.removeEventListener('mouseup', stopHoldTimer);
      node.removeEventListener('mouseleave', stopHoldTimer);
      node.removeEventListener('touchstart', startHoldTimer);
      node.removeEventListener('touchend', stopHoldTimer);
    };
  }, [startHoldTimer, stopHoldTimer]);

  return [ref];
};

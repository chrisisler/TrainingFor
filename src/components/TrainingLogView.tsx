import { css } from '@emotion/css';
import styled from '@emotion/styled';
import {
  Button,
  ClickAwayListener,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { MoreHoriz } from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import FlipMove from 'react-flip-move';
import { NavLink } from 'react-router-dom';
import { v4 as uuid } from 'uuid';

import { Format, Paths, TabIndex } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath, storage } from '../firebase';
import {
  Activity,
  ActivitySet,
  ActivityStatus,
  TrainingLog,
} from '../interfaces';
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

export const TrainingLogEditorView: FC<{ log: TrainingLog }> = ({ log }) => {
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Loading
  );

  useEffect(() => {
    return db
      .collection(DbPath.Users)
      .doc(log.authorId)
      .collection(DbPath.UserLogs)
      .doc(log.id)
      .collection(DbPath.UserLogActivities)
      .withConverter(DbConverter.Activity)
      .orderBy('position', 'desc')
      .onSnapshot(
        snapshot => setActivities(snapshot.docs.map(doc => doc.data())),
        error => setActivities(DataState.error(error.message))
      );
  }, [log.authorId, log.id]);

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
                  log={log}
                />
              </FlipMoveChild>
            ))}
          </FlipMove>
        </ActivitiesListContainer>
      )}
    </DataStateView>
  );
};

/**
 * Read-only view of a TrainingLog.
 * This component is for viewing logs not authored by the authenticated user.
 */
export const TrainingLogView: FC<{ log: TrainingLog }> = ({ log }) => {
  const [authorName] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(log.authorId)
        .get()
        .then(doc => doc.get('displayName')),
    [log.authorId]
  );

  const [activities] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(log.authorId)
        .collection(DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .orderBy('position', 'desc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [log.authorId, log.id]
  );

  const logDate = TrainingLog.getDate(log);

  return (
    <DataStateView data={activities} error={() => null}>
      {activities => (
        <div
          className={css`
            border-bottom: 1px solid lightgray;
          `}
        >
          <Columns padding={`${Pad.Medium}`}>
            <DataStateView data={authorName} error={() => null}>
              {authorName => (
                <Typography variant="body1" color="textPrimary">
                  <Link
                    component={NavLink}
                    to={Paths.user(log.authorId)}
                    className={css`
                      color: rgba(0, 0, 0, 0.87) !important;
                      text-decoration: underline !important;
                    `}
                  >
                    {authorName}
                  </Link>
                </Typography>
              )}
            </DataStateView>
            <Rows maxWidth between>
              {logDate && (
                <Typography variant="body2" color="textSecondary">
                  {format(logDate, Format.date)}
                  <br />
                  {format(logDate, Format.time)}
                </Typography>
              )}
              <Typography variant="body1" color="textSecondary">
                {log.title}
              </Typography>
            </Rows>
          </Columns>
          {activities.map(({ id }, index) => (
            <ActivityView
              key={id}
              activities={activities}
              index={index}
              log={log}
            />
          ))}
        </div>
      )}
    </DataStateView>
  );
};

const ImagePreview = styled.div`
  background-size: cover;
  background-image: url(${(props: { src: string }) => props.src});
  border-radius: 8px;
  width: 100%;
  min-height: 120px;
  height: 20vh;
  right: ${Pad.Large};
`;

/**
 * Provides a view upon an Activity object, displaying sets as well.
 *
 * If `editable` is true, this view is for the TrainingLogEditor.
 */
const ActivityView: FC<{
  /**
   * Caution! Providing the wrong value can break the entire app at runtime.
   */
  editable?: boolean;
  activities: Activity[];
  index: number;
  log: TrainingLog;
}> = ({ activities, index, editable = false, log }) => {
  const activity = activities[index];

  const attachmentRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const [notes, setNotes] = useState<Activity['notes']>(activity.notes);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openActivityMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const closeActivityMenu = () => setAnchorEl(null);

  const [pressHoldButtonRef] = usePressHoldRef(() =>
    addActivitySet(ActivityStatus.Completed)
  );

  const activityDocument = useMemo(
    () =>
      db
        .collection(DbPath.Users)
        .doc(log.authorId)
        .collection(DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .doc(activity.id),
    [activity.id, log.authorId, log.id]
  );

  const addActivityAttachment = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      closeActivityMenu();
      const attachment = event.target.files?.[0];
      if (!attachment) return;
      if (!window.confirm('Upload chosen attachment?')) return;
      const upload = storage.ref(`images/${attachment.name}`).put(attachment);
      upload.on(
        'state_changed',
        () => {
          /** no-op */
        },
        error => {
          alert(error.message);
        },
        async () => {
          const attachmentUrl = await storage
            .ref('images')
            .child(attachment.name)
            .getDownloadURL();
          activityDocument.update({ attachmentUrl } as Partial<Activity>);
        }
      );
    },
    [activityDocument]
  );

  const removeAttachment = useCallback(async () => {
    closeActivityMenu();
    if (!window.confirm('Remove image?')) return;
    if (activity.attachmentUrl === null) return;
    try {
      await storage.refFromURL(activity.attachmentUrl).delete();
      activityDocument.update({ attachmentUrl: null } as Partial<Activity>);
    } catch (error) {
      alert(error.message);
    }
  }, [activity.attachmentUrl, activityDocument]);

  const addActivitySet = useCallback(
    (status?: ActivityStatus) => {
      const weight = activity.sets[activity.sets.length - 1]?.weight ?? 0;
      const newSet: ActivitySet = {
        uuid: uuid(),
        name: `Set ${activity.sets.length + 1}`,
        notes: null,
        weight,
        status: status ?? ActivityStatus.Unattempted,
      };
      try {
        activityDocument.update({
          sets: firebase.firestore.FieldValue.arrayUnion(newSet),
        });
      } catch (error) {
        alert(error.message);
      }
    },
    [activity.sets, activityDocument]
  );

  const deleteActivity = useCallback(() => {
    closeActivityMenu();
    try {
      activityDocument.delete();
    } catch (error) {
      alert(error.message);
    }
  }, [activityDocument]);

  const renameActivity = useCallback(() => {
    closeActivityMenu();
    const newName = window.prompt('Update activity name', activity.name);
    if (!newName) return;
    try {
      activityDocument.set({ name: newName } as Partial<Activity>, {
        merge: true,
      });
    } catch (error) {
      alert(error.message);
    }
  }, [activity.name, activityDocument]);

  const moveActivityUp = useCallback(async () => {
    closeActivityMenu();
    if (activities.length === 1 || index === 0) return;
    try {
      const batch = db.batch();
      const otherActivityDocument = activityDocument.parent.doc(
        activities[index - 1].id
      );
      const swapped = (await otherActivityDocument.get()).get(
        'position'
      ) as number;
      batch.update(activityDocument, {
        position: swapped,
      } as Partial<Activity>);
      batch.update(otherActivityDocument, {
        position: activity.position,
      } as Partial<Activity>);
      await batch.commit();
    } catch (error) {
      alert(error.message);
    }
  }, [activities, activity.position, activityDocument, index]);

  const moveActivityDown = useCallback(async () => {
    closeActivityMenu();
    if (activities.length === 1 || index + 1 === activities.length) return;
    try {
      const batch = db.batch();
      const otherActivityDocument = activityDocument.parent.doc(
        activities[index + 1].id
      );
      const swapped = (await otherActivityDocument.get()).get(
        'position'
      ) as number;
      batch.update(activityDocument, {
        position: swapped,
      } as Partial<Activity>);
      batch.update(otherActivityDocument, {
        position: activity.position,
      } as Partial<Activity>);
      await batch.commit();
    } catch (error) {
      alert(error.message);
    }
  }, [activities, activity.position, activityDocument, index]);

  /** Close the notes input if it's empty, otherwise write notes to DB. */
  const updateActivityNotes = useCallback(async () => {
    // Hide notes if user set value to empty string
    const nullIfEmpty = notes === '' ? null : notes;
    setNotes(nullIfEmpty);
    try {
      activityDocument.update({ notes: nullIfEmpty } as Partial<Activity>);
    } catch (error) {
      alert(error.message);
    }
  }, [activityDocument, notes]);

  const showActivityNotesInput = useCallback(() => {
    closeActivityMenu();
    if (notes) return;
    // Make the notes textarea visible. See <ActivityNotesTextarea />
    setNotes('');
    // Wait for the event loop to render the element so we can focus it
    Promise.resolve().then(() => notesRef.current?.focus());
  }, [notes]);

  return (
    <Columns maxWidth padding={`0 ${Pad.Small} ${Pad.Small} ${Pad.Large}`}>
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
                    <MenuItem onClick={showActivityNotesInput}>
                      Add notes
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={
                      activity.attachmentUrl
                        ? removeAttachment
                        : () => attachmentRef.current?.click()
                    }
                  >
                    {activity.attachmentUrl ? 'Remove image' : 'Add image'}
                  </MenuItem>
                  <MenuItem onClick={renameActivity}>Rename activity</MenuItem>
                  <MenuItem onClick={deleteActivity}>Delete activity</MenuItem>
                </Menu>
                <input
                  ref={attachmentRef}
                  className={css`
                    width: 0;
                    height: 0;
                  `}
                  tabIndex={TabIndex.NotFocusable}
                  type="file"
                  accept="image/*"
                  onChange={addActivityAttachment}
                />
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
          background-color: transparent;
        `}
        value={notes ?? ''}
      />
      <FlipMove enterAnimation="fade" leaveAnimation="fade">
        {activity.sets.map(({ uuid }, index) => (
          <FlipMoveChild key={uuid}>
            <ActivitySetView
              index={index}
              sets={activity.sets}
              editable={editable}
              activityDocument={activityDocument}
            />
          </FlipMoveChild>
        ))}
      </FlipMove>
      {activity.attachmentUrl && <ImagePreview src={activity.attachmentUrl} />}
    </Columns>
  );
};

const ActivitySetView: FC<{
  index: number;
  sets: ActivitySet[];
  editable: boolean;
  activityDocument: firebase.firestore.DocumentReference<Activity>;
}> = ({ index, sets, editable, activityDocument }) => {
  const set = sets[index];
  const [weight, setWeight] = useState(set.weight);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openSetMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const closeSetMenu = () => setAnchorEl(null);

  const cycleSetStatus = useCallback(() => {
    sets[index].status = Activity.cycleStatus(set.status);
    try {
      activityDocument.set({ sets }, { merge: true });
    } catch (error) {
      alert(error.message);
    }
  }, [activityDocument, index, set.status, sets]);

  const duplicateSet = useCallback(() => {
    closeSetMenu();
    try {
      const duplicateSet = {
        ...sets[index],
        uuid: uuid(),
        notes: null,
        status: ActivityStatus.Unattempted,
      };
      activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayUnion(duplicateSet),
      });
    } catch (error) {
      alert(error.message);
    }
  }, [activityDocument, index, sets]);

  const deleteSet = useCallback(() => {
    closeSetMenu();
    try {
      activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayRemove(set),
      });
    } catch (error) {
      alert(error.message);
    }
  }, [activityDocument, set]);

  const renameSet = useCallback(() => {
    closeSetMenu();
    const newName = window.prompt('Update set name', set.name);
    if (!newName) return;
    try {
      sets[index].name = newName;
      activityDocument.set({ sets } as Partial<Activity>, { merge: true });
    } catch (error) {
      alert(error.message);
    }
  }, [activityDocument, index, set.name, sets]);

  const updateSetWeight = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      sets[index].weight = Number(event.target.value);
      try {
        activityDocument.set({ sets } as Partial<Activity>, { merge: true });
      } catch (error) {
        alert(error.message);
      }
    },
    [activityDocument, index, sets]
  );

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

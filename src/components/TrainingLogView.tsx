import { css } from '@emotion/css';
import styled from '@emotion/styled';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { ChatBubbleOutline, MoreHoriz, MoreVert } from '@material-ui/icons';
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
import { toast } from 'react-toastify';
import { v4 as uuid } from 'uuid';

import { Format, Paths, TabIndex } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath, storage } from '../firebase';
import { useUser } from '../hooks';
import {
  Activity,
  ActivitySet,
  ActivityStatus,
  Comment,
  TrainingLog,
} from '../interfaces';
import { Columns, Pad, Rows } from '../style';
import { AppLink } from './AppLink';

const ActivityStatusButton = styled.button`
  color: gray;
  font-size: 0.75em;
  border: 0;
  font-weight: 800;
  background-color: transparent;
  text-transform: uppercase;
  outline: none;
`;

const activityViewContainerCss = css`
  display: flex;
  flex-direction: column;
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
    <DataStateView data={activities}>
      {activities => (
        <FlipMove
          enterAnimation="fade"
          leaveAnimation="fade"
          className={css`
            height: 100%;
            width: 100%;
            overflow-y: scroll;
            ${activityViewContainerCss}
          `}
        >
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
    <DataStateView data={activities}>
      {activities => (
        <div
          className={css`
            border-bottom: 1px solid lightgray;
            background-color: #fefefe;
          `}
        >
          <Columns padding={`${Pad.Medium}`}>
            <DataStateView data={authorName}>
              {authorName => (
                <Typography variant="body1" color="textPrimary">
                  <AppLink to={Paths.user(log.authorId)}>{authorName}</AppLink>
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
          <div className={activityViewContainerCss}>
            {activities.map(({ id }, index) => (
              <ActivityView
                key={id}
                activities={activities}
                index={index}
                log={log}
              />
            ))}
          </div>
        </div>
      )}
    </DataStateView>
  );
};

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
  const commentRef = useRef<HTMLInputElement | null>(null);

  const [notes, setNotes] = useState<Activity['notes']>(activity.notes);
  const [comment, setComment] = useState<null | string>(null);
  const [comments, setComments] = useState<DataState<Comment[]>>(
    DataState.Empty
  );

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openActivityMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(event.currentTarget);
  const closeActivityMenu = () => setAnchorEl(null);

  const user = useUser();

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
      if (!window.confirm('Confirm attachment?')) return;
      const upload = storage.ref(`images/${attachment.name}`).put(attachment);
      upload.on(
        'state_changed',
        () => {
          /** no-op */
        },
        error => {
          toast.error(error.message);
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
      toast.error(error.message);
    }
  }, [activity.attachmentUrl, activityDocument]);

  const addActivitySet = useCallback(() => {
    const weight = activity.sets[activity.sets.length - 1]?.weight ?? 0;
    const newSet: ActivitySet = {
      uuid: uuid(),
      name: `Set ${activity.sets.length + 1}`,
      notes: null,
      weight,
      status: ActivityStatus.Unattempted,
    };
    try {
      activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayUnion(newSet),
      });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activity.sets, activityDocument]);

  const deleteActivity = useCallback(() => {
    closeActivityMenu();
    try {
      activityDocument.delete();
    } catch (error) {
      toast.error(error.message);
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
      toast.error(error.message);
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
      toast.error(error.message);
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
      toast.error(error.message);
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
      toast.error(error.message);
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

  const showActivityCommentInput = useCallback(() => {
    if (comment) {
      // TODO Route to comments view for this activity
      return;
    }
    // Unhide the comment input and focus it
    setComment('');
    Promise.resolve().then(() => commentRef.current?.focus());
  }, [comment]);

  const addActivityComment = useCallback(
    <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!user.displayName || !comment) return;
      try {
        const newComment: Omit<Comment, 'id'> = {
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          text: comment,
          author: {
            id: user.uid,
            displayName: user.displayName,
          },
        };
        setComment('');
        activityDocument
          .collection(DbPath.UserLogActivityComments)
          .add(newComment);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activityDocument, comment, user.displayName, user.uid]
  );

  // Load `comments` and subscribe to changes to the collection
  useEffect(() => {
    return activityDocument
      .collection(DbPath.UserLogActivityComments)
      .withConverter(DbConverter.Comment)
      .orderBy('timestamp', 'desc')
      .limit(3)
      .onSnapshot(
        snapshot => setComments(snapshot.docs.map(doc => doc.data())),
        err => setComments(DataState.error(err.message))
      );
  }, [activityDocument]);

  return (
    <Columns
      className={css`
        margin: ${Pad.Medium};
        border-radius: 8px;
        padding: ${Pad.Medium};
        padding-bottom: ${Pad.Small};
        box-shadow: 4px 4px 12px 0px rgba(0, 0, 0, 0.1);
      `}
      pad={Pad.Small}
    >
      <Rows pad={Pad.Small}>
        <Columns
          pad={Pad.Small}
          className={css`
            width: min-content;
          `}
        >
          <div
            className={css`
              border: 1px solid lightgray;
              border-radius: 5px;
              width: 80px;
              height: 80px;
              position: relative;
              overflow: hidden;
            `}
            onClick={({ target, currentTarget }) => {
              if (!editable) return;
              if (target !== currentTarget) return;
              addActivitySet();
            }}
          >
            {editable && (
              <ClickAwayListener onClickAway={closeActivityMenu}>
                <div
                  className={css`
                    position: absolute;
                    left: -5%;
                    top: 5%;
                  `}
                >
                  <IconButton
                    disabled={!editable}
                    aria-label="Open activity menu"
                    aria-controls="activity-menu"
                    aria-haspopup="true"
                    onClick={openActivityMenu}
                    size="small"
                  >
                    <MoreVert
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
                        activities.length === 1 ||
                        index + 1 === activities.length
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
                    <MenuItem onClick={renameActivity}>
                      Rename activity
                    </MenuItem>
                    <MenuItem onClick={deleteActivity}>
                      <b>Delete activity</b>
                    </MenuItem>
                  </Menu>
                  <input
                    ref={attachmentRef}
                    className={css`
                      width: 0.1px;
                      height: 0.1px;
                      opacity: 0;
                      position: abslute;
                      overflow: hidden;
                    `}
                    tabIndex={TabIndex.NotFocusable}
                    type="file"
                    accept="image/*"
                    onChange={addActivityAttachment}
                  />
                </div>
              </ClickAwayListener>
            )}
            <p
              className={css`
                position: absolute;
                left: 10%;
                color: rgba(0, 0, 0, 0.87);
                bottom: 8%;
                font-size: 1.3em;
                text-transform: uppercase;
              `}
            >
              {Activity.abbreviate(activity.name)}
            </p>
          </div>
          <p
            className={css`
              color: rgba(0, 0, 0, 0.87);
            `}
          >
            {activity.name}
          </p>
          <ol
            className={css`
              padding: 0;

              & > li {
                display: inline-block;
                height: 25px;
                margin-right: 4px;
                width: 4px;
                background-color: palevioletred;
                border-radius: 4px;

                &:nth-child(5n) {
                  transform: rotate(300deg);
                  height: 35px;
                  position: relative;
                  left: -20px;
                  top: 5px;
                  margin-top: -${Pad.Small};
                }
              }
            `}
          >
            {activity.sets.map(() => (
              <li />
            ))}
          </ol>
        </Columns>
        <Columns maxWidth>
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
              width: 100%;
              color: gray;
              border: 0;
              padding: 0;
              resize: none;
              font-size: 0.8em;
              font-style: italic;
              font-family: inherit;
              background-color: transparent;
            `}
            value={notes ?? ''}
          />
          {editable ? (
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
          ) : (
            <>
              {activity.sets.map(({ uuid }, index) => (
                <ActivitySetView
                  key={uuid}
                  index={index}
                  sets={activity.sets}
                  editable={editable}
                  activityDocument={activityDocument}
                />
              ))}
            </>
          )}
        </Columns>
      </Rows>
      <Columns pad={Pad.Small}>
        <DataStateView data={comments} loading={() => null} error={() => null}>
          {comments =>
            comments.length === 0 ? null : (
              <Columns
                pad={Pad.XSmall}
                className={css`
                  font-size: 0.8em;
                  color: rgba(0, 0, 0, 0.52);
                `}
              >
                {comments.map(comment => (
                  <Rows pad={Pad.XSmall} key={comment.id}>
                    <p>
                      <b>{comment.author.displayName}</b>
                    </p>
                    <p>{comment.text}</p>
                  </Rows>
                ))}
              </Columns>
            )
          }
        </DataStateView>
        <Rows maxWidth center pad={Pad.XSmall}>
          <IconButton
            aria-label="Add comment"
            size="small"
            onClick={showActivityCommentInput}
          >
            <ChatBubbleOutline
              className={css`
                color: rgba(0, 0, 0, 0.24);
              `}
            />
          </IconButton>
          {typeof comment === 'string' && (
            <>
              <form
                onSubmit={addActivityComment}
                className={css`
                  width: 100%;
                `}
              >
                <input
                  type="text"
                  ref={commentRef}
                  placeholder="Add a comment..."
                  value={comment ?? ''}
                  onChange={event => setComment(event.target.value)}
                  onBlur={() => {
                    // Hide the comment input
                    if (comment === '') setComment(null);
                  }}
                  className={css`
                    background-color: transparent;
                    font-size: 0.8em;
                    color: rgba(0, 0, 0, 0.87);
                    border: none;
                    flex: 1;
                    width: 100%;
                    margin: 0;
                    outline: none;
                    padding: ${Pad.XSmall} 0;
                  `}
                />
              </form>
              {comment && comment.length > 0 && (
                <button
                  className={css`
                    border: none;
                    padding: 0;
                    background-color: transparent;
                    text-transform: uppercase;
                    font-size: 0.8em;
                    font-weight: 600;
                    outline: none;
                    color: rgba(0, 0, 0, 0.52);
                  `}
                  onClick={addActivityComment}
                >
                  Post
                </button>
              )}
            </>
          )}
        </Rows>
      </Columns>
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
      toast.error(error.message);
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
      toast.error(error.message);
    }
  }, [activityDocument, index, sets]);

  const deleteSet = useCallback(() => {
    closeSetMenu();
    try {
      activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayRemove(set),
      });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, set]);

  const updateSetWeight = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      sets[index].weight = Number(event.target.value);
      try {
        activityDocument.set({ sets } as Partial<Activity>, { merge: true });
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activityDocument, index, sets]
  );

  return (
    <Rows maxWidth center between>
      <Rows center>
        <Typography
          variant="subtitle1"
          className={css`
            font-size: 0.8em;
            color: lightgray;
            font-style: italic;
          `}
        >
          {index + 1}
        </Typography>
        <ActivityStatusButton disabled={!editable} onClick={cycleSetStatus}>
          {set.status}
        </ActivityStatusButton>
      </Rows>
      <Rows center>
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
            width: 4ch;
            color: gray;
            border: 0;
            font-family: monospace;
            text-align: center;
          `}
        />
        {editable && (
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
                <MenuItem onClick={deleteSet}>
                  <b>Delete set</b>
                </MenuItem>
              </Menu>
            </div>
          </ClickAwayListener>
        )}
      </Rows>
    </Rows>
  );
};

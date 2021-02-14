import { css } from '@emotion/css';
import styled from '@emotion/styled';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import {
  Add,
  ChatBubbleOutline,
  MoreHoriz,
  MoreVert,
} from '@material-ui/icons';
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
import {
  Line,
  LineChart,
  ResponsiveContainer as ChartContainer,
} from 'recharts';
import { v4 as uuid } from 'uuid';

import { Format, Paths, TabIndex } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath, storage } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import {
  Activity,
  ActivitySet,
  ActivityStatus,
  Comment,
  TrainingLog,
} from '../interfaces';
import { Columns, Pad, Rows } from '../style';
import { AppLink } from './AppLink';

const activityViewContainerStyle = css`
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
    <DataStateView data={activities} loading={() => null}>
      {activities =>
        activities.length ? (
          <FlipMove
            enterAnimation="fade"
            leaveAnimation="fade"
            className={css`
              height: 100%;
              width: 100%;
              overflow-y: scroll;
              ${activityViewContainerStyle}
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
        ) : (
          <FlipMove enterAnimation="fade" leaveAnimation="fade">
            <FlipMoveChild>
              <Typography
                variant="body1"
                color="textSecondary"
                className={css`
                  padding: ${Pad.Large};
                `}
              >
                No activities, add one to get started!
              </Typography>
            </FlipMoveChild>
          </FlipMove>
        )
      }
    </DataStateView>
  );
};

/**
 * Read-only view of a TrainingLog.
 * This component is for viewing logs not authored by the authenticated user.
 */
export const TrainingLogView: FC<{ log: TrainingLog }> = ({ log }) => {
  const [authorName] = useDataState<string>(
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
    <DataStateView data={activities} error={() => null} loading={() => null}>
      {activities => (
        <div
          className={css`
            border-bottom: 1px solid lightgray;
            background-color: #fefefe;
          `}
        >
          <Columns padding={`${Pad.Medium}`}>
            {DataState.isReady(authorName) && (
              <Typography variant="body1" color="textPrimary">
                <AppLink to={Paths.user(log.authorId)}>{authorName}</AppLink>
              </Typography>
            )}
            <Rows maxWidth between>
              {logDate && (
                <Typography variant="body2" color="textSecondary">
                  {format(logDate, Format.date)}
                  <br />
                  {format(logDate, Format.time)}
                </Typography>
              )}
              <Typography variant="body1" color="textPrimary">
                {log.title}
              </Typography>
            </Rows>
          </Columns>
          <div className={activityViewContainerStyle}>
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

const ActivityView: FC<{
  /**
   * If set to true, this view is for the TrainingLogEditor.
   *
   * CAUTION: Providing the wrong value will break the entire app!
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

  const menu = useMaterialMenu();

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
      menu.close();
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
    [activityDocument, menu]
  );

  const removeAttachment = useCallback(async () => {
    menu.close();
    if (!window.confirm('Remove image?')) return;
    if (activity.attachmentUrl === null) return;
    try {
      await storage.refFromURL(activity.attachmentUrl).delete();
      activityDocument.update({ attachmentUrl: null } as Partial<Activity>);
    } catch (error) {
      toast.error(error.message);
    }
  }, [activity.attachmentUrl, activityDocument, menu]);

  const addActivitySet = useCallback(() => {
    const lastSet = activity.sets[activity.sets.length - 1];
    const weight = lastSet?.weight ?? 0;
    const repCount = lastSet?.repCount ?? null;
    const newSet: ActivitySet = {
      uuid: uuid(),
      name: `Set ${activity.sets.length + 1}`,
      notes: null,
      weight,
      repCount,
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
    menu.close();
    try {
      activityDocument.delete();
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, menu]);

  const renameActivity = useCallback(() => {
    menu.close();
    const newName = window.prompt('Update activity name', activity.name);
    if (!newName) return;
    try {
      activityDocument.set({ name: newName } as Partial<Activity>, {
        merge: true,
      });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activity.name, activityDocument, menu]);

  const moveActivityUp = useCallback(async () => {
    menu.close();
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
  }, [activities, activity.position, activityDocument, index, menu]);

  const moveActivityDown = useCallback(async () => {
    menu.close();
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
  }, [activities, activity.position, activityDocument, index, menu]);

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
    menu.close();
    if (notes) return;
    // Make the notes textarea visible. See <ActivityNotesTextarea />
    setNotes('');
    // Wait for the event loop to render the element so we can focus it
    Promise.resolve().then(() => notesRef.current?.focus());
  }, [notes, menu]);

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
        // Hide (and unfocus) the comment input.
        setComment(null);
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
        border: 1px solid lightgray;
      `}
      pad={Pad.Small}
    >
      <Rows pad={Pad.Medium}>
        <Columns
          pad={Pad.Small}
          className={css`
            width: min-content;
          `}
        >
          <div
            className={css`
              box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
              border-radius: 5px;
              width: 80px;
              height: 80px;
              position: relative;
              overflow: hidden;
            `}
            onClick={event => {
              if (!editable) return;
              const self = event.currentTarget;
              const target = event.target as EventTarget & Node;
              // Add set if not clicking menu icon
              if (!self.contains(target)) return;
              if (self.firstElementChild?.contains(target)) return;
              addActivitySet();
            }}
          >
            {editable && (
              <ClickAwayListener onClickAway={menu.close}>
                <div
                  className={css`
                    position: absolute;
                    left: -3%;
                    top: 3%;
                  `}
                >
                  <IconButton
                    disabled={!editable}
                    aria-label="Open activity menu"
                    aria-controls="activity-menu"
                    aria-haspopup="true"
                    onClick={menu.open}
                    size="small"
                  >
                    <MoreVert
                      className={css`
                        color: gray;
                      `}
                    />
                  </IconButton>
                  <Menu
                    id="activity-menu"
                    anchorEl={menu.ref}
                    open={!!menu.ref}
                    onClose={menu.close}
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
            <div
              className={css`
                position: absolute;
                left: 65%;
                bottom: 63%;
              `}
            >
              <Add
                className={css`
                  color: dodgerblue;
                `}
              />
            </div>
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
            {activity.sets.map(({ uuid }) => (
              <li key={uuid} />
            ))}
          </ol>
        </Columns>
        <Columns maxWidth>
          {activity.sets.length > 2 && activity.sets[1].weight > 0 && (
            <ChartContainer height={30} width="100%">
              <LineChart data={activity.sets}>
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#99eb99"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          )}
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
  const [repCount, setRepCount] = useState(set.repCount);

  const menu = useMaterialMenu();

  const cycleSetStatus = useCallback(() => {
    sets[index].status = Activity.cycleStatus(set.status);
    try {
      activityDocument.set({ sets }, { merge: true });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, index, set.status, sets]);

  const duplicateSet = useCallback(() => {
    menu.close();
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
  }, [activityDocument, index, sets, menu]);

  const deleteSet = useCallback(() => {
    menu.close();
    try {
      activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayRemove(set),
      });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, set, menu]);

  const updateSets = useCallback(
    (sets: ActivitySet[]) => {
      try {
        activityDocument.set({ sets } as Partial<Activity>, { merge: true });
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activityDocument]
  );

  const setInputStyle = useMemo(
    () => css`
      background-color: transparent;
      width: 4ch;
      font-size: 1em;
      border: none;
      outline: none;
      padding: 0;
      font-family: sans-serif;
      font-style: italic;
    `,
    []
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
        <button
          disabled={!editable}
          onClick={cycleSetStatus}
          className={css`
            color: gray;
            font-size: 0.75em;
            border: 0;
            font-weight: 800;
            background-color: transparent;
            text-transform: uppercase;
            outline: none;
          `}
        >
          {set.status}
        </button>
      </Rows>
      <div
        className={css`
          display: flex;
          align-items: baseline;
        `}
      >
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
          onBlur={event => {
            sets[index].weight = Number(event.target.value);
            updateSets(sets);
          }}
          className={css`
            ${setInputStyle}
            font-weight: 400;
            text-align: right;
            color: rgba(0, 0, 0, 0.87);
          `}
        />
        <p
          className={css`
            font-family: monospace;
            font-weight: 0.8em;
            font-weight: 600;
            font-style: italic;
            color: rgba(0, 0, 0, 0.52);
          `}
        >
          x
        </p>
        <input
          disabled={!editable}
          type="tel"
          min={0}
          max={999}
          name="repCount"
          value={repCount ?? 0}
          onChange={event => {
            if (Number.isNaN(event.target.value)) return;
            setRepCount(Number(event.target.value));
          }}
          onBlur={event => {
            sets[index].repCount = Number(event.target.value);
            updateSets(sets);
          }}
          className={css`
            ${setInputStyle}
            color: rgba(0, 0, 0, 0.52);
            font-weight: 600;
          `}
        />
      </div>
      {editable && (
        <ClickAwayListener onClickAway={menu.close}>
          <div>
            <IconButton
              disabled={!editable}
              size="small"
              aria-label="Open set menu"
              aria-controls="set-menu"
              aria-haspopup="true"
              onClick={menu.open}
            >
              <MoreHoriz
                className={css`
                  color: lightgray;
                `}
              />
            </IconButton>
            <Menu
              id="set-menu"
              anchorEl={menu.ref}
              open={!!menu.ref}
              onClose={menu.close}
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
  );
};

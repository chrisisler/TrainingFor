import { css } from '@emotion/css';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { ChatBubbleOutline, MoreHoriz } from '@material-ui/icons';
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

import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useResizableInputRef, useUser } from '../hooks';
import {
  Activity,
  ActivitySet,
  ActivityStatus,
  Comment,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';
import { FlipMoveChild } from './FlipMoveChild';

export const ActivityView: FC<{
  /**
   * If set to true, this view is for the TrainingLogEditor.
   *
   * CAUTION: Providing the wrong value will break the entire app!
   */
  editable?: boolean;
  activities: Activity[];
  index: number;
  log: TrainingLog | TrainingTemplate;
}> = ({ activities, index, editable = false, log }) => {
  const activity = activities[index];
  const isTemplate = TrainingLog.isTemplate(log);

  const commentRef = useRef<HTMLInputElement | null>(null);

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
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .doc(activity.id),
    [activity.id, log.authorId, log.id, isTemplate]
  );

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
        padding: ${Pad.Small} ${Pad.Medium};
        border: 1px solid lightgray;
      `}
      pad={Pad.Small}
    >
      <Columns pad={Pad.Medium}>
        <Rows
          pad={Pad.Medium}
          center
          className={css`
            width: min-content;
          `}
        >
          <Columns>
            <p
              className={css`
                color: ${Color.FontPrimary};
                font-size: 1.1rem;
              `}
              onClick={addActivitySet}
            >
              {activity.name}
            </p>
            <ol
              className={css`
                padding: 0;
                height: 12px;

                & > li {
                  display: inline-block;
                  height: 100%;
                  margin-right: 5px;
                  width: 4px;
                  background-color: palevioletred;
                  border-radius: 4px;

                  &:nth-child(5n) {
                    transform: rotate(-75deg);
                    height: 260%;
                    position: relative;
                    left: -22px;
                    top: 10px;
                    margin-top: -${Pad.Medium};
                  }
                }
              `}
            >
              {activity.sets.map(({ uuid }) => (
                <li key={uuid} />
              ))}
            </ol>
          </Columns>
          {editable && (
            <ClickAwayListener onClickAway={menu.close}>
              <div
                className={css`
                  margin-left: auto;
                `}
              >
                <IconButton
                  disabled={!editable}
                  aria-label="Open activity menu"
                  aria-controls="activity-menu"
                  aria-haspopup="true"
                  onClick={menu.open}
                >
                  <MoreHoriz
                    className={css`
                      color: ${Color.ActionSecondaryGray};
                    `}
                    fontSize="small"
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
                      activities.length === 1 || index + 1 === activities.length
                    }
                  >
                    Move down
                  </MenuItem>
                  <MenuItem onClick={renameActivity}>Rename activity</MenuItem>
                  <MenuItem onClick={deleteActivity}>
                    <b>Delete activity</b>
                  </MenuItem>
                </Menu>
              </div>
            </ClickAwayListener>
          )}
        </Rows>
        <FlipMove
          enterAnimation="fade"
          leaveAnimation="fade"
          className={css`
            display: flex;
            flex-wrap: wrap;
            width: 100%;
            max-height: 150px;
            overflow-y: scroll;

            & > :not(:last-child) {
              margin-bottom: ${Pad.XSmall};
            }
          `}
        >
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
      </Columns>
      <Columns pad={Pad.Small}>
        <DataStateView data={comments} loading={() => null} error={() => null}>
          {comments =>
            comments.length === 0 ? null : (
              <Columns
                pad={Pad.XSmall}
                className={css`
                  font-size: ${Font.Small};
                  color: ${Color.FontSecondary};
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
                    font-size: ${Font.Small};
                    color: ${Color.FontPrimary};
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
                    font-size: ${Font.Small};
                    font-weight: 600;
                    outline: none;
                    color: ${Color.FontSecondary};
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

  const resizeWeightInput = useResizableInputRef();
  const resizeRepCountInput = useResizableInputRef();

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

  const setInputStyle = useCallback(
    (value: number) => css`
      background-color: transparent;
      width: 3ch;
      border: none;
      outline: none;
      padding: 0;
      font-family: sans-serif;
      color: ${value === 0 ? Color.ActionSecondaryGray : 'palevioletred'};
      font-weight: 400;
      font-size: ${Font.Medium};
    `,
    []
  );

  return (
    <Rows center between>
      <Columns center>
        <Rows maxWidth center pad={Pad.Large}>
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
                <Typography
                  variant="subtitle1"
                  className={css`
                    color: ${Color.ActionPrimaryBlue};
                    font-style: italic;
                    line-height: 1 !important;
                  `}
                >
                  {index + 1}
                </Typography>
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
          <div
            className={css`
              display: flex;
              align-items: baseline;
            `}
          >
            <input
              disabled={!editable}
              ref={resizeWeightInput}
              type="tel"
              min={0}
              max={999}
              name="weight"
              value={weight}
              onFocus={event => {
                event.currentTarget.select();
              }}
              onChange={event => {
                if (Number.isNaN(event.target.value)) return;
                setWeight(Number(event.target.value));
              }}
              onBlur={event => {
                sets[index].weight = Number(event.target.value);
                updateSets(sets);
              }}
              className={css`
                ${setInputStyle(weight)}
                text-align: end;
              `}
            />
            <p
              className={css`
                font-family: monospace;
                font-style: italic;
                color: ${Color.ActionSecondaryGray};
                font-weight: 600;
              `}
            >
              x
            </p>
            <input
              disabled={!editable}
              ref={resizeRepCountInput}
              type="tel"
              min={0}
              max={999}
              name="repCount"
              value={repCount ?? 0}
              onFocus={event => {
                event.currentTarget.select();
              }}
              onChange={event => {
                if (Number.isNaN(event.target.value)) return;
                setRepCount(Number(event.target.value));
              }}
              onBlur={event => {
                sets[index].repCount = Number(event.target.value);
                updateSets(sets);
              }}
              className={css`
                ${setInputStyle(repCount ?? 0)}
              `}
            />
          </div>
        </Rows>
        <button
          disabled={!editable}
          onClick={cycleSetStatus}
          className={css`
            color: ${Color.ActionPrimaryGray};
            padding: ${Pad.XSmall};
            font-size: 0.78rem;
            border: 0;
            font-weight: 800;
            background-color: transparent;
            text-transform: uppercase;
            outline: none;
            width: 100px;
            text-align: left;
          `}
        >
          {set.status}
        </button>
      </Columns>
    </Rows>
  );
};

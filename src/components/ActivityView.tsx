import { css } from '@emotion/css';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { Add, ChevronRight, Close } from '@material-ui/icons';
import firebase from 'firebase/app';
import React, {
  FC,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import FlipMove from 'react-flip-move';
import { toast } from 'react-toastify';

import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useResizableInputRef, useUser } from '../hooks';
import {
  Activity,
  ActivityRepCountUnit,
  ActivitySet,
  ActivityStatus,
  ActivityWeightUnit,
  Comment,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

export const ActivityView = forwardRef<
  HTMLDivElement,
  {
    /**
     * If set to true, this view is for the TrainingLogEditor.
     *
     * CAUTION: Providing the wrong value will break the entire app!
     */
    editable?: boolean;
    activities: Activity[];
    index: number;
    log: TrainingLog | TrainingTemplate;
  }
>(({ activities, index, editable = false, log }, ref) => {
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
        .user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .doc(activity.id),
    [activity.id, log.authorId, log.id, isTemplate]
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

  const addActivitySet = useCallback(() => {
    const prevSet = activity.sets[activity.sets.length - 1];
    const weight = prevSet?.weight ?? 0;
    const repCount = prevSet?.repCount ?? null;
    const status =
      prevSet?.status === ActivityStatus.Optional
        ? ActivityStatus.Optional
        : ActivityStatus.Unattempted;
    const newSet = ActivitySet.create({ weight, repCount, status });
    try {
      activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayUnion(newSet),
      });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activity.sets, activityDocument]);

  const duplicateActivity = useCallback(async () => {
    menu.close();
    // Guaranteed array position due to existence
    const position = activities[activities.length - 1].position + 1;
    const duplicate: Activity = { ...activity, position };
    try {
      activityDocument.parent.add(duplicate);
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, activity, menu, activities]);

  const removeAllSets = useCallback(async () => {
    menu.close();
    try {
      await activityDocument.update({ sets: [] });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, menu]);

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

  const showActivityCommentInput = useCallback(() => {
    menu.close();
    if (comment) return;
    // Unhide the comment input and focus it
    setComment('');
    Promise.resolve().then(() => commentRef.current?.focus());
  }, [comment, menu]);

  const addActivityComment = useCallback(
    <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!user.displayName || !comment) return;
      try {
        const newComment = Comment.create({
          text: comment,
          author: {
            id: user.uid,
            displayName: user.displayName,
          },
        });
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

  const cycleWeightUnit = useCallback(async () => {
    try {
      activityDocument.set(
        { weightUnit: Activity.cycleWeightUnit(activity.weightUnit) },
        { merge: true }
      );
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, activity.weightUnit]);

  const cycleRepCountUnit = useCallback(async () => {
    try {
      activityDocument.set(
        { repCountUnit: Activity.cycleRepCountUnit(activity.repCountUnit) },
        { merge: true }
      );
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, activity.repCountUnit]);

  /** Styles used for the buttons which control reps vs time vs etc. */
  const activityUnitButtonStyle = css`
    color: ${Color.ActionPrimaryGray};
    border-radius: 8px;
    border: 0;
    border-bottom: 1px solid ${Color.ActionSecondaryGray};
    padding: ${Pad.XSmall} ${Pad.Medium};
    font-size: ${Font.Small};
    background-color: transparent;
    min-width: fit-content !important;
    outline: none;
  `;

  return (
    <Columns
      ref={ref}
      className={css`
        padding: ${Pad.Medium} ${Pad.Small} 0;
        margin: ${Pad.Small} ${Pad.Medium};
        border-radius: 20px;
        background-color: #fff;
      `}
      pad={Pad.Small}
    >
      <Rows center>
        {editable && (
          <button
            onClick={addActivitySet}
            className={css`
              color: ${Color.ActionPrimaryBlue};
              background-color: transparent;
              border: none;
              border: 1px solid ${Color.ActionPrimaryBlue};
              border-radius: 50%;
              height: min-content;
              padding: ${Pad.XSmall};
              margin-right: ${Pad.Small};
              outline: none;
            `}
          >
            <Add
              fontSize="small"
              /** Border 50% does NOT make A Perfect Circle without this. */
              className={css`
                margin-bottom: -2px;
              `}
            />
          </button>
        )}
        <Columns maxWidth>
          <ClickAwayListener onClickAway={menu.close}>
            <div>
              <button
                disabled={!editable}
                aria-label="Open activity menu"
                aria-controls="activity-menu"
                aria-haspopup="true"
                onClick={menu.open}
                className={css`
                  color: ${Color.FontPrimary};
                  font-size: ${Font.Medium};
                  font-weight: 400;
                  padding: 0;
                  border: none;
                  background-color: transparent;
                  font-family: system-ui;
                  outline: none;
                  text-align: left;
                `}
              >
                <ActivityNameBold name={activity.name} />
              </button>
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
                <MenuItem onClick={renameActivity}>Edit name</MenuItem>
                <MenuItem onClick={showActivityCommentInput}>
                  Add comment
                </MenuItem>
                <MenuItem onClick={duplicateActivity}>
                  Duplicate activity
                </MenuItem>
                {activity.sets.length > 1 && (
                  <MenuItem
                    onClick={() => {
                      if (!window.confirm('Remove all sets?')) return;
                      removeAllSets();
                    }}
                  >
                    Remove all sets
                  </MenuItem>
                )}
                <MenuItem onClick={deleteActivity}>
                  <b>Delete activity</b>
                </MenuItem>
              </Menu>
            </div>
          </ClickAwayListener>
        </Columns>
      </Rows>
      <Rows pad={Pad.Medium}>
        <Columns pad={Pad.Small}>
          {!!activity.sets.length && (
            <Rows
              className={css`
                align-items: flex-end;
              `}
            >
              <button
                disabled={!editable}
                onClick={cycleWeightUnit}
                className={activityUnitButtonStyle}
              >
                {activity.weightUnit}
              </button>
              <button
                disabled={!editable}
                onClick={cycleRepCountUnit}
                className={activityUnitButtonStyle}
              >
                {activity.repCountUnit}
              </button>
              <ChevronRight
                fontSize="small"
                className={css`
                  color: ${Color.ActionSecondaryGray} !important;
                `}
              />
            </Rows>
          )}
          {!!activity.sets.length &&
            activity.weightUnit !== ActivityWeightUnit.Weightless && (
              <p
                className={css`
                  font-size: ${Font.Small};
                  color: ${Color.FontSecondary};
                `}
              >
                Volume: {Activity.getVolume(activity)}
              </p>
            )}
        </Columns>
        <FlipMove
          enterAnimation="fade"
          leaveAnimation="fade"
          className={css`
            display: flex;
            flex-wrap: wrap;
            width: 100%;
            max-height: 360px;
            overflow-y: scroll;
            height: min-content;
          `}
        >
          {activity.sets.map(({ uuid }, index) => (
            <ActivitySetView
              key={uuid}
              index={index}
              activity={activity}
              editable={editable}
              activityDocument={activityDocument}
              isTemplate={isTemplate}
            />
          ))}
        </FlipMove>
      </Rows>
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
                    {(editable || user.uid === comment.author.id) && (
                      <IconButton
                        aria-label="Delete comment"
                        onClick={() => {
                          activityDocument
                            .collection(DbPath.UserLogActivityComments)
                            .doc(comment.id)
                            .delete()
                            .catch(error => {
                              toast.error(error.message);
                            });
                        }}
                        size="small"
                        className={css`
                          margin-left: auto !important;
                        `}
                      >
                        <Close
                          fontSize="small"
                          className={css`
                            color: ${Color.ActionSecondaryGray};
                          `}
                        />
                      </IconButton>
                    )}
                  </Rows>
                ))}
              </Columns>
            )
          }
        </DataStateView>
        <Rows maxWidth center pad={Pad.XSmall}>
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
});

const ActivitySetView = forwardRef<
  HTMLDivElement,
  {
    index: number;
    activity: Activity;
    editable: boolean;
    activityDocument: firebase.firestore.DocumentReference<Activity>;
    isTemplate: boolean;
  }
>(({ index, activity, editable, activityDocument, isTemplate }, ref) => {
  const { sets, weightUnit, repCountUnit } = activity;
  const set = sets[index];

  const resizeWeightInput = useResizableInputRef();
  const resizeRepCountInput = useResizableInputRef();

  const [weight, setWeight] = useState(set.weight);
  const [repCount, setRepCount] = useState(set.repCount);

  const menu = useMaterialMenu();

  const statusColor = useMemo(
    () => ActivitySet.getStatusColor(set.status),
    [set.status]
  );

  const setInputStyle = useCallback(
    (value: number) => css`
      background-color: transparent;
      width: 3ch;
      border: none;
      outline: none;
      padding: ${Pad.XSmall};
      font-family: sans-serif;
      color: ${value === 0
        ? Color.ActionSecondaryGray
        : Color.ActionPrimaryRed};
      font-weight: 400;
      font-size: 1.2rem;
    `,
    []
  );

  const cycleSetStatus = useCallback(() => {
    if (isTemplate) {
      sets[index].status =
        set.status === ActivityStatus.Unattempted
          ? ActivityStatus.Optional
          : ActivityStatus.Unattempted;
    } else {
      sets[index].status = ActivitySet.cycleStatus(set.status);
    }
    try {
      activityDocument.set({ sets }, { merge: true });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, index, set.status, sets, isTemplate]);

  const duplicateSet = useCallback(() => {
    menu.close();
    try {
      const duplicateSet = ActivitySet.create({
        status: ActivityStatus.Unattempted,
        weight: set.weight,
        repCount: set.repCount,
      });
      activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayUnion(duplicateSet),
      });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, set, menu]);

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
        activityDocument.set({ sets } as Partial<Activity>, {
          merge: true,
        });
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activityDocument]
  );
  const insertNewSet = useCallback(() => {
    menu.close();
    try {
      const newSet = ActivitySet.create({ ...activity.sets[index] });
      const { sets } = activity;
      // Insert `newSet` item at `index`, deleting 0 items,
      sets.splice(index + 1, 0, newSet);
      activityDocument.set({ sets } as Partial<Activity>, { merge: true });
    } catch (error) {
      toast.error(error.message);
    }
  }, [activityDocument, activity, index, menu]);

  return (
    <Rows ref={ref} center between maxWidth>
      <Rows
        className={css`
          align-items: baseline;
        `}
      >
        {weightUnit !== ActivityWeightUnit.Weightless && (
          <>
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
            <X>x</X>
          </>
        )}
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
        {repCountUnit === ActivityRepCountUnit.Seconds && <X>s</X>}
        {repCountUnit === ActivityRepCountUnit.Minutes && <X>m</X>}
        {repCountUnit === ActivityRepCountUnit.Meters && <X>m</X>}
      </Rows>
      <div>
        <button
          disabled={!editable}
          onClick={cycleSetStatus}
          className={css`
            color: ${Color.FontPrimary};
            padding: ${Pad.XSmall};
            font-size: ${Font.Small};
            border: 0;
            font-weight: 500;
            background-color: transparent;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            font-family: system-ui, Verdana, sans-serif;
            outline: none;
            width: 100%;
            text-align: left;
            color: ${statusColor};
          `}
        >
          {set.status}
        </button>
      </div>
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
                color: ${Color.ActionSecondaryGray};
                font-weight: 600 !important;
                font-style: italic;
                line-height: 1 !important;
                width: 2ch;
                font-size: ${Font.MedLarge};
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
            <MenuItem onClick={insertNewSet}>Insert new set</MenuItem>
            <MenuItem onClick={duplicateSet}>Duplicate set</MenuItem>
            <MenuItem onClick={deleteSet}>
              <b>Delete set</b>
            </MenuItem>
          </Menu>
        </div>
      </ClickAwayListener>
    </Rows>
  );
});

const X: FC = ({ children }) => (
  <p
    className={css`
      color: ${Color.ActionSecondaryGray};
      font-size: ${Font.Small};
    `}
  >
    {children}
  </p>
);

/**
 * Displays the given Activity name with several or none parts in
 * bold based on the number of words.
 */
const ActivityNameBold: FC<{ name: string }> = ({ name }) => {
  const parts = name.split(/\s+/g);
  const numParts = parts.length;
  if (numParts === 0) {
    throw Error('Unreachable');
  } else if (numParts === 1) {
    return (
      <>
        <b>{name}</b>
      </>
    );
  } else if (numParts === 2 || numParts === 3) {
    const [first, ...rest] = parts;
    return (
      <>
        <b>{first}</b> {rest.join(' ')}
      </>
    );
  } else if (numParts >= 4) {
    const [first, second, ...rest] = parts;
    return (
      <>
        <b>
          {first} {second}
        </b>{' '}
        {rest.join(' ')}
      </>
    );
  } else {
    throw Error('Unreachable');
  }
};

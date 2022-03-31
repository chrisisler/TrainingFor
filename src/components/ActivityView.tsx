import { css } from '@emotion/css';
import {
  Divider,
  Grid,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { Add, Close, DeleteOutlined, ExpandMore, Favorite, FavoriteBorder, FileCopyOutlined } from '@material-ui/icons';
import firebase from 'firebase/app';
import React, { FC, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { API } from '../apis';
import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useResizableInputRef, useUser } from '../hooks';
import {
  Activity,
  ActivitySet,
  ActivitySetStatus,
  ActivityWeightUnit,
  Comment,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

const activitySetInputStyle = css`
  background-color: transparent;
  width: 3ch;
  border: none;
  outline: none;
  line-height: 1 !important;
  text-align: end;
  padding: 0 ${Pad.XSmall};
  font-family: sans-serif;
  color: ${Color.ActionPrimaryBlue};
  font-weight: 400;
  font-size: 2.125rem;
  letter-spacing: 0.004em;
`;

export const ActivityView = forwardRef<
  HTMLDivElement,
  {
    /**
     * If set to true, this view is for the TrainingLogEditor.
     *
     * CAUTION: Providing the wrong value will break the entire app!
     * @default false
     */
    editable?: boolean;
    activities: Activity[];
    /**
     * Which of the `activities` are we rendering?
     */
    index: number;
    log: TrainingLog | TrainingTemplate;
  }
>(({ activities, index, editable = false, log }, ref) => {
  const activity = activities[index];
  const isTemplate = TrainingLog.isTemplate(log);

  const commentRef = useRef<HTMLInputElement | null>(null);

  const resizeWeightInput = useResizableInputRef();
  const resizeRepCountInput = useResizableInputRef();

  const [comment, setComment] = useState<null | string>(null);
  const [comments, setComments] = useState<DataState<Comment[]>>(DataState.Empty);

  /**
   * The set being edited.
   */
  const [selectedSet, setSelectedSet] = useState<undefined | ActivitySet>(
    () =>
      activity.sets.find(_ => _.status !== ActivitySetStatus.Completed) ??
      activity.sets?.[activity.sets.length - 1] ??
      undefined
  );
  const [weight, setWeight] = useState(selectedSet?.weight ?? 0);
  const [repCount, setRepCount] = useState(selectedSet?.repCount ?? 0);

  /** Activity menu. */
  const menu = useMaterialMenu();
  const selectedSetMenu = useMaterialMenu();
  const user = useUser();

  /** The ID of the <3'ed Activity. */
  const favoritedActivity = useMemo(
    () => activities.find(_ => _.isFavorite)?.id ?? null,
    [activities]
  );

  const activityDocument = useMemo(
    () =>
      db
        .user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .doc(activity.id),
    [activity, log.authorId, log.id, isTemplate]
  );

  // Update the selected set input controls as other sets are selected
  useEffect(() => {
    if (!selectedSet) return;
    setWeight(selectedSet?.weight ?? 0);
    setRepCount(selectedSet?.repCount ?? 0);
  }, [selectedSet]);

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

  const addActivitySet = useCallback(async (): Promise<ActivitySet> => {
    const prevSet = activity.sets[activity.sets.length - 1];
    const weight = prevSet?.weight ?? 0;
    const repCount = prevSet?.repCount ?? null;
    const status =
      prevSet?.status === ActivitySetStatus.Optional
        ? ActivitySetStatus.Optional
        : ActivitySetStatus.Unattempted;
    const newSet = ActivitySet.create({ weight, repCount, status });
    try {
      await activityDocument.update({
        sets: firebase.firestore.FieldValue.arrayUnion(newSet),
      });
      return newSet;
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
      return Promise.reject();
    }
  }, [activity.sets, activityDocument]);

  const duplicateActivity = useCallback(async () => {
    menu.close();
    // Guaranteed array position due to existence
    const position = activities[activities.length - 1].position + 1;
    const duplicate: Activity = { ...activity, position };
    try {
      await activityDocument.parent.add(duplicate);
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activityDocument, activity, menu, activities]);

  const removeAllSets = useCallback(async () => {
    menu.close();
    try {
      await activityDocument.update({ sets: [] });
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activityDocument, menu]);

  const deleteActivity = useCallback(async () => {
    menu.close();
    try {
      await activityDocument.delete();
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activityDocument, menu]);

  const renameActivity = useCallback(async () => {
    menu.close();
    const newName = window.prompt('Update activity name', activity.name);
    if (!newName) return;
    try {
      await activityDocument.set({ name: newName } as Partial<Activity>, {
        merge: true,
      });
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activity.name, activityDocument, menu]);

  const moveActivityUp = useCallback(async () => {
    if (activities.length === 1 || index === 0) return;
    try {
      const batch = db.batch();
      const otherActivityDocument = activityDocument.parent.doc(activities[index - 1].id);
      const swapped = (await otherActivityDocument.get()).get('position') as number;
      batch.update(activityDocument, {
        position: swapped,
      } as Partial<Activity>);
      batch.update(otherActivityDocument, {
        position: activity.position,
      } as Partial<Activity>);
      await batch.commit();
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activities, activity.position, activityDocument, index]);

  const moveActivityDown = useCallback(async () => {
    if (activities.length === 1 || index + 1 === activities.length) return;
    try {
      const batch = db.batch();
      const otherActivityDocument = activityDocument.parent.doc(activities[index + 1].id);
      const swapped = (await otherActivityDocument.get()).get('position') as number;
      batch.update(activityDocument, {
        position: swapped,
      } as Partial<Activity>);
      batch.update(otherActivityDocument, {
        position: activity.position,
      } as Partial<Activity>);
      await batch.commit();
    } catch (error) {
      // @ts-ignore
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
    async <E extends React.SyntheticEvent>(event: E) => {
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
        await activityDocument.collection(DbPath.UserLogActivityComments).add(newComment);
      } catch (error) {
        // @ts-ignore
        toast.error(error.message);
      }
    },
    [activityDocument, comment, user.displayName, user.uid]
  );

  const cycleWeightUnit = useCallback(async () => {
    try {
      await activityDocument.set(
        { weightUnit: Activity.cycleWeightUnit(activity.weightUnit) },
        { merge: true }
      );
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activityDocument, activity.weightUnit]);

  const cycleRepCountUnit = useCallback(async () => {
    try {
      await activityDocument.set(
        { repCountUnit: Activity.cycleRepCountUnit(activity.repCountUnit) },
        { merge: true }
      );
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activityDocument, activity.repCountUnit]);

  /** Favorite the current Activity and unfavorite others */
  const toggleFavorite = useCallback(async () => {
    try {
      // Has one been favorited? Is it the current one?
      if (favoritedActivity && favoritedActivity !== activity.id) {
        activityDocument.parent.doc(favoritedActivity).set({ isFavorite: false }, { merge: true });
      }
      await activityDocument.set({ isFavorite: !activity.isFavorite }, { merge: true });
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [activity.id, activity.isFavorite, activityDocument, favoritedActivity]);

  // TODO
  const updateSets = useCallback(
    async (sets: ActivitySet[]) => {
      try {
        await activityDocument.set({ sets } as Partial<Activity>, {
          merge: true,
        });
      } catch (error) {
        // @ts-ignore
        toast.error(error.message);
      }
    },
    [activityDocument]
  );

  return (
    <Columns
      ref={ref}
      className={css`
        padding: ${Pad.Small} ${Pad.Medium};
        padding-bottom: ${Pad.XSmall};
        margin: ${Pad.Small} ${Pad.Small};
        border-radius: 20px;
        background-color: #fff;
      `}
      pad={Pad.Small}
    >
      <Rows center maxWidth between>
        <Rows center pad={Pad.XSmall}>
          {/** ACTIVITY NAME & BUTTON */}
          <button
            disabled={!editable}
            aria-label="Open activity menu"
            aria-controls="activity-menu"
            aria-haspopup="true"
            onClick={menu.open}
            className={css`
              color: ${Color.FontPrimary};
              font-size: ${Font.MedLarge};
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
          <ExpandMore sx={{ color: Color.ActionSecondaryGray }} fontSize="small" />
        </Rows>
        <Menu
          id="activity-menu"
          anchorEl={menu.ref}
          open={!!menu.ref}
          onClose={menu.close}
          MenuListProps={{ dense: true }}
        >
          <MenuItem onClick={moveActivityUp} disabled={activities.length === 1 || index === 0}>
            Move up
          </MenuItem>
          <MenuItem
            onClick={moveActivityDown}
            disabled={activities.length === 1 || index + 1 === activities.length}
          >
            Move down
          </MenuItem>
          <MenuItem onClick={renameActivity}>Edit name</MenuItem>
          <MenuItem onClick={showActivityCommentInput}>Add comment</MenuItem>
          <MenuItem onClick={duplicateActivity}>Duplicate activity</MenuItem>
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

        {/** FAVORITE ICON */}
        {!isTemplate && (
          <Rows center>
            {activity.sets.length > 1 && (
              <Typography variant="overline" color="textSecondary" sx={{ lineHeight: 1 }} noWrap>
                Vol: {Activity.getVolume(activity)}
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={toggleFavorite}
              // TODO Fix animation on safari
              className={css`
                color: ${activity.isFavorite ? '#cc0000' : Color.ActionSecondaryGray} !important;

                // https://www.w3schools.com/howto/howto_css_shake_image.asp
                :active {
                  animation: shake 0.5s;
                  animation-iteration-count: 1;
                }
                // prettier-ignore
                @keyframes shake {
                  0% { transform: translate(1px, 1px) rotate(0deg); }
                  10% { transform: translate(-1px, -2px) rotate(-1deg); }
                  20% { transform: translate(-3px, 0px) rotate(1deg); }
                  30% { transform: translate(3px, 2px) rotate(0deg); }
                  40% { transform: translate(1px, -1px) rotate(1deg); }
                  50% { transform: translate(-1px, 2px) rotate(-1deg); }
                  60% { transform: translate(-3px, 1px) rotate(0deg); }
                  70% { transform: translate(3px, 1px) rotate(-1deg); }
                  80% { transform: translate(-1px, -1px) rotate(1deg); }
                  90% { transform: translate(1px, 2px) rotate(0deg); }
                  100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
              `}
            >
              {activity.isFavorite ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
          </Rows>
        )}
      </Rows>

      {/** SELECTED SET CONTROLS */}
      {!!selectedSet && (
        <>
          <Rows>
            <Columns maxWidth>
              {activity.sets.length > 0 && (
                <Typography variant="overline" color="textSecondary" sx={{ lineHeight: 1 }}>
                  Set {(activity.sets.findIndex(_ => _.uuid === selectedSet.uuid) ?? 0) + 1}
                </Typography>
              )}
              {/** SELECTED SET STATUS BUTTON */}
              {/** TODO: Add dropdown arrow for a status Select */}
              <button
                onClick={async () => {
                  if (!editable) return;
                  if (!selectedSet) return;
                  try {
                    // Update the DB then reflect that change in the FE if successful
                    const set = await API.ActivitySet.cycleStatus(log, activity, selectedSet);
                    // TODO
                    // this approach is not scalable at all, every user updating a
                    // set status hits the network...  just POST the finished log
                    // state once the log is done!
                    setSelectedSet(set);
                  } catch (error) {
                    // @ts-ignore
                    toast.error(error.message);
                  }
                }}
                className={css`
                  padding: ${Pad.XSmall};
                  padding-left: 0;
                  font-size: 1.2rem;
                  border: 0;
                  font-weight: 300;
                  background-color: transparent;
                  letter-spacing: 0.02em;
                  text-transform: uppercase;
                  font-family: system-ui, Verdana, sans-serif;
                  outline: none;
                  width: 100%;
                  text-align: left;
                  color: ${ActivitySet.getStatusColor(selectedSet.status)};
                `}
              >
                {selectedSet.status}
              </button>
            </Columns>

            {/** SELECTED SET VALUE CONTROLS */}
            <Grid container justifyContent="end" alignItems="flex-end" wrap="nowrap">
              {/** WEIGHT VALUE */}
              {activity.weightUnit !== ActivityWeightUnit.Weightless && (
                <Grid item>
                  <input
                    disabled={!editable}
                    ref={resizeWeightInput}
                    type="tel"
                    min={0}
                    max={9999}
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
                      const index = activity.sets.findIndex(_ => _.uuid === selectedSet.uuid);
                      if (index === -1) return toast.error('Could not find selected set index.');
                      activity.sets[index].weight = Number(event.target.value);
                      updateSets(activity.sets);
                    }}
                    className={activitySetInputStyle}
                  />
                </Grid>
              )}
              {/** WEIGHT UNIT */}
              <Grid item>
                <IconButton
                  disabled={!editable}
                  onClick={cycleWeightUnit}
                  size="small"
                  className={css`
                    font-size: 1rem !important;
                  `}
                >
                  {activity.weightUnit.toUpperCase()}
                </IconButton>
              </Grid>
              {/** REP VALUE */}
              <Grid item>
                <input
                  disabled={!editable}
                  ref={resizeRepCountInput}
                  type="tel"
                  min={0}
                  max={9999}
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
                    const index = activity.sets.findIndex(_ => _.uuid === selectedSet.uuid);
                    if (index === -1) return toast.error('Could not find selected set index.');
                    activity.sets[index].repCount = Number(event.target.value);
                    updateSets(activity.sets);
                  }}
                  className={css`
                    ${activitySetInputStyle};
                  `}
                />
              </Grid>

              {/** REP UNIT */}
              <Grid item>
                <IconButton
                  disabled={!editable}
                  onClick={cycleRepCountUnit}
                  size="small"
                  className={css`
                    font-size: 1rem !important;
                  `}
                >
                  {activity.repCountUnit.toUpperCase()}
                </IconButton>
              </Grid>
            </Grid>
          </Rows>
          {/** ACTIVITY SET MENU */}
          <Menu
            id="activity-set-menu"
            anchorEl={selectedSetMenu.ref}
            open={!!selectedSetMenu.ref}
            onClose={selectedSetMenu.close}
          >
            <MenuItem dense>
              {/** Display the set index as menu title */}
              <Typography color="textSecondary">
                Set{' '}
                {
                  activity.sets.flatMap((_, index) =>
                    _.uuid === selectedSet?.uuid ? index + 1 : []
                  )[0]
                }
              </Typography>
            </MenuItem>

            <Divider />

            <MenuItem
              onClick={async () => {
                selectedSetMenu.close();
                if (!selectedSet) return;
                try {
                  await API.ActivitySet.insertNew(log, activities, index, selectedSet);
                } catch (error) {
                  // @ts-ignore
                  toast.error(error.message);
                }
              }}
            >
              <ListItemIcon>
                <FileCopyOutlined />
              </ListItemIcon>
              <Typography>Duplicate set</Typography>
            </MenuItem>
            <MenuItem
              onClick={async () => {
                selectedSetMenu.close();
                if (!selectedSet) return;
                try {
                  await API.ActivitySet.deleteSet(log, activity, selectedSet);
                  // Select the previous set
                  setSelectedSet(activity.sets[activity.sets.length - 2]);
                } catch (error) {
                  // @ts-ignore
                  toast.error(error.message);
                }
              }}
            >
              <ListItemIcon>
                <DeleteOutlined color="error" />
              </ListItemIcon>
              <Typography color="error">Delete set</Typography>
            </MenuItem>
          </Menu>
        </>
      )}

      {/** HORIZONTAL SET LIST */}
      <Grid container alignItems="center" wrap="nowrap" marginTop={`-${Pad.Small}`}>
        {/** ADD SET BUTTON */}
        {editable && (
          <Grid
            item
            onClick={async () => {
              const setCount = activity.sets.length;
              const set = await addActivitySet();
              setSelectedSet(set);
              // If this is the first set of the activity, focus the data input
              if (setCount === 0) {
                resizeWeightInput.current?.focus();
              }
            }}
          >
            <IconButton
              sx={{
                marginLeft: '-16px',
                color: Color.ActionPrimaryBlue,
              }}
            >
              <Add />
            </IconButton>
          </Grid>
        )}

        {/** SCROLLING LIST OF SETS */}
        <Grid
          item
          container
          overflow="scroll"
          wrap="nowrap"
          // To avoid scrollbar/height clashing
          paddingBottom={Pad.Small}
          marginTop={`${Pad.Small}`}
          className={css`
            & > *:not(:last-child) {
              margin-right: ${Pad.Medium};
            }
          `}
        >
          {activity.sets.map(set => {
            const isSelectedSet = selectedSet?.uuid === set.uuid;
            return (
              <Grid
                item
                whiteSpace="nowrap"
                key={set.uuid}
                onClick={event => {
                  if (isSelectedSet) {
                    selectedSetMenu.open(event);
                  } else {
                    setSelectedSet(set);
                  }
                }}
              >
                <Typography
                  variant="body1"
                  color={isSelectedSet ? 'textPrimary' : 'textSecondary'}
                  className={css`
                    padding: ${Pad.XSmall} ${Pad.Small} !important;
                    line-height: 1 !important;
                    border-bottom: 2px solid ${ActivitySet.getStatusColor(set.status)};
                    ${isSelectedSet &&
                    `
                      border-bottom: 5px solid ${ActivitySet.getStatusColor(set.status)};
                    `}
                  `}
                >
                  {set.weight === 0 ? (
                    <>
                      x<b>{set.repCount}</b>
                    </>
                  ) : (
                    <>
                      {set.weight}x<b>{set.repCount}</b>
                    </>
                  )}
                </Typography>
              </Grid>
            );
          })}
        </Grid>
      </Grid>

      {/** COMMENTS */}
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

      {/** COMMENTING */}
      {typeof comment === 'string' && (
        <Rows maxWidth center pad={Pad.XSmall}>
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
        </Rows>
      )}
    </Columns>
  );
});

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

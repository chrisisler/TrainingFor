import { css } from '@emotion/css';
import {
  ClickAwayListener,
  Divider,
  Grid,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { Add, Close, DeleteOutlined, Favorite, FavoriteBorder } from '@material-ui/icons';
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
  const [selectedSet, setSelectedSet] = useState<undefined | ActivitySet>(undefined);
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

  /** Styles used for the buttons which control reps vs time vs etc. */
  // const activityUnitButtonStyle = css`
  //   color: ${Color.ActionPrimaryGray};
  //   border-radius: 8px;
  //   border: 0;
  //   border-bottom: 1px solid ${Color.ActionSecondaryGray};
  //   padding: ${Pad.XSmall} ${Pad.Medium};
  //   font-size: ${Font.Small};
  //   background-color: transparent;
  //   min-width: fit-content !important;
  //   outline: none;
  // `;

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

  ///
  ///
  ///
  /// #region Selected Set Display and Controls/Actions Logic
  ///
  ///
  ///

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
  /// #endregion

  return (
    <Columns
      ref={ref}
      className={css`
        padding: ${Pad.Medium} ${Pad.Medium} ${Pad.Small};
        margin: ${Pad.Small} ${Pad.Small};
        border-radius: 20px;
        background-color: #fff;
      `}
      pad={Pad.Small}
    >
      <Rows center>
        <Columns maxWidth>
          {/** ACTIVITY NAME & BUTTON */}
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
            </div>
          </ClickAwayListener>
        </Columns>

        {/** FAVORITE ICON */}
        {!isTemplate && (
          <IconButton
            size="small"
            onClick={toggleFavorite}
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
        )}
      </Rows>

      {/** SELECTED SET CONTROLS */}
      {!!selectedSet && (
        <>
          <Rows>
            {/** SELECTED SET STATUS BUTTON */}
            <button
              key={JSON.stringify(activity)}
              onClick={async () => {
                if (!editable) return;
                if (!selectedSet) return;
                try {
                  // Update the DB then reflect that change in the FE if successful
                  const set = await API.ActivitySet.cycleStatus(log, activity, selectedSet);
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
                font-weight: 200;
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

            {/** SELECTED SET VALUE CONTROLS */}
            {activity.sets.length > 0 && (
              <Grid container justifyContent="end" alignItems="end" wrap="nowrap">
                {/** WEIGHT VALUE */}
                {/** TODO: Input-ify */}
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
                        activity.sets[index].weight = Number(event.target.value);
                        updateSets(activity.sets);
                      }}
                      className={activitySetInputStyle}
                    />
                  </Grid>
                )}
                {/** WEIGHT UNIT */}
                {/** TODO: NativeSelect-ify */}
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
                {/** TODO: Input-ify */}
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
                      activity.sets[index].repCount = Number(event.target.value);
                      updateSets(activity.sets);
                    }}
                    className={css`
                      ${activitySetInputStyle};
                    `}
                  />
                  {/* {repCountUnit === ActivityRepCountUnit.Seconds && <X>s</X>}
                    {repCountUnit === ActivityRepCountUnit.Minutes && <X>m</X>}
                    {repCountUnit === ActivityRepCountUnit.Meters && <X>m</X>} */}
                </Grid>

                {/** REP UNIT */}
                {/** TODO: NativeSelect-ify */}
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
            )}
          </Rows>
          {/** ACTIVITY SET MENU */}
          <ClickAwayListener onClickAway={selectedSetMenu.close}>
            <div>
              {/** HORIZONTAL SET LIST */}
              <Grid container alignItems="center" wrap="nowrap">
                {/** ADD SET BUTTON */}
                {editable && (
                  <Grid
                    item
                    onClick={() => {
                      addActivitySet().then(setSelectedSet);
                    }}
                    // To avoid scrollbar/height clashing
                    paddingBottom={Pad.Small}
                  >
                    <IconButton
                      className={css`
                        padding: ${Pad.XSmall} !important;
                        padding-right: ${Pad.Small} !important;
                        color: ${Color.ActionPrimaryBlue} !important;
                        margin-bottom: 2px !important;
                      `}
                    >
                      <Add />
                    </IconButton>
                  </Grid>
                )}

                {/** SCROLLING LIST OF SETS */}
                <Grid
                  item
                  container
                  spacing={2.0}
                  overflow="scroll"
                  wrap="nowrap"
                  // To avoid scrollbar/height clashing
                  paddingBottom={Pad.Small}
                >
                  {activity.sets.map((set, index) => {
                    const isSelectedSet = selectedSet?.uuid === set.uuid;
                    return (
                      <Grid
                        item
                        whiteSpace="nowrap"
                        key={set.uuid}
                        onClick={event => {
                          if (isSelectedSet) selectedSetMenu.open(event);
                          else setSelectedSet(set);
                        }}
                      >
                        <Typography
                          variant="body1"
                          color={isSelectedSet ? 'textPrimary' : 'textSecondary'}
                          className={css`
                            padding: ${Pad.XSmall} ${Pad.Small} !important;
                            line-height: 1 !important;
                            border-bottom: 1px solid ${ActivitySet.getStatusColor(set.status)};
                            ${isSelectedSet &&
                            `border: 1px solid ${ActivitySet.getStatusColor(set.status)};`}
                            ${isSelectedSet && 'border-radius: 5px;'}
                          `}
                        >
                          {set.weight === 0 ? (
                            <>
                              x<b>{set.repCount}</b>
                            </>
                          ) : (
                            <>
                              <b>{set.weight}</b>x{set.repCount}
                            </>
                          )}
                        </Typography>
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>

              <Menu
                id="activity-set-menu"
                anchorEl={selectedSetMenu.ref}
                open={!!selectedSetMenu.ref}
                onClose={selectedSetMenu.close}
              >
                <MenuItem dense>
                  <Typography color="textSecondary">
                    Set #
                    {
                      activity.sets.flatMap((_, index) =>
                        _.uuid === selectedSet.uuid ? index + 1 : []
                      )[0]
                    }
                  </Typography>
                </MenuItem>

                <Divider />

                <MenuItem
                  onClick={async () => {
                    selectedSetMenu.close();
                    try {
                      await API.ActivitySet.insertNew(log, activities, index, selectedSet);
                    } catch (error) {
                      // @ts-ignore
                      toast.error(error.message);
                    }
                  }}
                >
                  <ListItemIcon>
                    <Add />
                  </ListItemIcon>
                  <Typography>Insert new set</Typography>
                </MenuItem>
                <MenuItem
                  onClick={async () => {
                    selectedSetMenu.close();
                    // deleteSet();
                    try {
                      await API.ActivitySet.deleteSet(log, activity, selectedSet);
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
            </div>
          </ClickAwayListener>
        </>
      )}

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

// const ActivitySetView = forwardRef<
//   HTMLDivElement,
//   {
//     index: number;
//     activity: Activity;
//     editable: boolean;
//     activityDocument: firebase.firestore.DocumentReference<Activity>;
//     isTemplate: boolean;
//   }
// >(({ index, activity, editable, activityDocument, isTemplate }, ref) => {
//   const { sets, weightUnit, repCountUnit } = activity;
//   const set = sets[index];

//   const resizeWeightInput = useResizableInputRef();
//   const resizeRepCountInput = useResizableInputRef();

//   const { sets, weightUnit, repCountUnit } = activity;
//   const [weight, setWeight] = useState(set.weight);
//   const [repCount, setRepCount] = useState(set.repCount);

//   const statusColor = useMemo(() => ActivitySet.getStatusColor(set.status), [set.status]);

//   return (
//     <Rows ref={ref} center between maxWidth>
//       <Rows
//         className={css`
//           align-items: baseline;
//         `}
//       >
//         {weightUnit !== ActivityWeightUnit.Weightless && (
//           <>
//             <input
//               disabled={!editable}
//               ref={resizeWeightInput}
//               type="tel"
//               min={0}
//               max={999}
//               name="weight"
//               value={weight}
//               onFocus={event => {
//                 event.currentTarget.select();
//               }}
//               onChange={event => {
//                 if (Number.isNaN(event.target.value)) return;
//                 setWeight(Number(event.target.value));
//               }}
//               onBlur={event => {
//                 sets[index].weight = Number(event.target.value);
//                 updateSets(sets);
//               }}
//               className={css`
//                 ${setInputStyle(weight)}
//                 text-align: end;
//               `}
//             />
//             <X>x</X>
//           </>
//         )}
//         <input
//           disabled={!editable}
//           ref={resizeRepCountInput}
//           type="tel"
//           min={0}
//           max={999}
//           name="repCount"
//           value={repCount ?? 0}
//           onFocus={event => {
//             event.currentTarget.select();
//           }}
//           onChange={event => {
//             if (Number.isNaN(event.target.value)) return;
//             setRepCount(Number(event.target.value));
//           }}
//           onBlur={event => {
//             sets[index].repCount = Number(event.target.value);
//             updateSets(sets);
//           }}
//           className={css`
//             ${setInputStyle(repCount ?? 0)}
//           `}
//         />
//         {repCountUnit === ActivityRepCountUnit.Seconds && <X>s</X>}
//         {repCountUnit === ActivityRepCountUnit.Minutes && <X>m</X>}
//         {repCountUnit === ActivityRepCountUnit.Meters && <X>m</X>}
//       </Rows>
//       <div>
//         <button
//           disabled={!editable}
//           onClick={cycleSetStatus}
//           className={css`
//             color: ${Color.FontPrimary};
//             padding: ${Pad.XSmall};
//             font-size: ${Font.Small};
//             border: 0;
//             font-weight: 500;
//             background-color: transparent;
//             letter-spacing: 0.02em;
//             text-transform: uppercase;
//             font-family: system-ui, Verdana, sans-serif;
//             outline: none;
//             width: 100%;
//             text-align: left;
//             color: ${statusColor};
//           `}
//         >
//           {set.status}
//         </button>
//       </div>
//       <ClickAwayListener onClickAway={seletedSetMenu.close}>
//         <div>
//           <IconButton
//             disabled={!editable}
//             size="small"
//             aria-label="Open set menu"
//             aria-controls="set-menu"
//             aria-haspopup="true"
//             onClick={seletedSetMenu.open}
//           >
//             <Typography
//               variant="subtitle1"
//               className={css`
//                 color: ${Color.ActionSecondaryGray};
//                 font-weight: 600 !important;
//                 line-height: 1 !important;
//                 width: 2ch;
//                 font-size: 1.2rem;
//               `}
//             >
//               {index + 1}
//             </Typography>
//           </IconButton>
//           <Menu
//             id="set-menu"
//             anchorEl={seletedSetMenu.ref}
//             open={!!seletedSetMenu.ref}
//             onClose={seletedSetMenu.close}
//             MenuListProps={{ dense: true }}
//           >
//             <MenuItem
//               onClick={() => {
//                 seletedSetMenu.close();
//                 insertNewSet();
//               }}
//             >
//               Insert new set
//             </MenuItem>
//             <MenuItem
//               onClick={() => {
//                 seletedSetMenu.close();
//                 duplicateSet();
//               }}
//             >
//               Duplicate set
//             </MenuItem>
//             <MenuItem
//               onClick={() => {
//                 seletedSetMenu.close();
//                 deleteSet();
//               }}
//             >
//               <b>Delete set</b>
//             </MenuItem>
//           </Menu>
//         </div>
//       </ClickAwayListener>
//     </Rows>
//   );
// });

// const X: FC<{ children: React.ReactNode }> = ({ children }) => (
//   <p
//     className={css`
//       color: ${Color.ActionSecondaryGray};
//       font-size: ${Font.Small};
//     `}
//   >
//     {children}
//   </p>
// );

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

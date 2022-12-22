import { css } from '@emotion/css';
import {
  Badge,
  Box,
  Button,
  ClickAwayListener,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  NativeSelect,
  Stack,
  SwipeableDrawer,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@material-ui/core';
import { Add, Check, ChevronRight, Delete, Save } from '@material-ui/icons';
import { format } from 'date-fns';
import firebase from 'firebase/app';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Format, Paths, Weekdays } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { auth, db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import { Behavior, Checkin, SavedActivity, TrainingLog, TrainingTemplate } from '../interfaces';
import { baseBg, Color, Columns, Pad, Rows } from '../style';

/**
 * Presents the currently authenticated user and their logs OR presents another
 * user's account and logs with a button to follow/unfollow.
 */
export const Account: FC = () => {
  const [newBehaviorName, setNewBehaviorName] = useState('');
  // The Behavior instance being edited, if the context menu was opened for it
  const [editingBehavior, setEditingBehavior] = useState<null | Behavior>(null);

  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();
  const user = useUser();
  const menu = useMaterialMenu();
  const history = useHistory();
  // Skip the `ref` prop since <SwipeableDrawer /> does not use it.
  const { ref: _1, ...behaviorsDrawer } = useMaterialMenu();
  const { ref: _2, ...addEditBehaviorDrawer } = useMaterialMenu();
  const { ref: _3, ...checkinDrawer } = useMaterialMenu();
  const { ref: _4, ...newTrainingDrawer } = useMaterialMenu();

  /**
   * TODO
   * Account UI re-write:
   * - [x] List of logs rendered + clicking takes user to log in editor view
   * - [x] Templates have the graph removed (poor API handling)
   * - [ ] Use Drawer UI for creating new logs! Integrate the NewTraining page
   * - [ ] Implement list of viewable logs UI from each template as Drawer
   */

  // const [selectedUser] = useDataState(
  //   () =>
  //     db
  //       .user(userId)
  //       .get()
  //       .then(doc => {
  //         const user = doc.data();
  //         if (!user) return DataState.error('User document does not exist');
  //         return user;
  //       }),
  //   [userId]
  // );

  /** Whether or not the user has completed their check in for the day. */
  const [hasCheckedIn] = useDataState(async () => {
    if (userId) return;
    const snapshot = await db
      .user(user.uid)
      .collection(DbPath.UserCheckins)
      .withConverter(DbConverter.Checkin)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    if (snapshot.size === 1) {
      const checkin = snapshot.docs[0]?.data?.();
      const checkinDate = (checkin?.timestamp as firebase.firestore.Timestamp)?.toDate();
      const today = new Date();
      if (checkinDate && checkinDate.toDateString() === today.toDateString()) {
        return true;
      }
    }
    return false;
  }, [user.uid]);

  const [templates] = useDataState(
    () =>
      db
        .user(userId ?? user.uid)
        .collection(DbPath.UserTemplates)
        .withConverter(DbConverter.TrainingTemplate)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [userId, user.uid]
  );

  const [logs] = useDataState(
    () =>
      db
        .user(userId ?? user.uid)
        .collection(DbPath.UserLogs)
        .withConverter(DbConverter.TrainingLog)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [userId, user.uid]
  );

  const [behaviors, setBehaviors] = useDataState(async () => {
    if (behaviorsDrawer.open) {
      return db
        .user(user.uid)
        .collection(DbPath.UserBehaviors)
        .withConverter(DbConverter.Behavior)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data()));
    }
    return DataState.Empty;
  }, [behaviorsDrawer.open, user.uid]);

  const deleteAccount = useCallback(async () => {
    menu.onClose();
    const text = window.prompt('Type "delete" to delete account');
    if (!!text && text?.toLowerCase() !== 'delete') return;
    try {
      // TODO Promise.all awaits
      await db.user(user.uid).delete();
      if (!auth.currentUser) throw Error('Unreachable');
      await auth.currentUser.delete();
      toast.info('Account deleted successfully.');
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, menu]);

  const closeEditedDrawer = useCallback(() => {
    addEditBehaviorDrawer.onClose();

    setNewBehaviorName('');
    if (editingBehavior) setEditingBehavior(null);
  }, [addEditBehaviorDrawer, editingBehavior]);

  return (
    <Columns
      pad={Pad.Large}
      className={css`
        height: 100%;
        padding: ${Pad.Small} 0;
        background-color: ${baseBg};
      `}
    >
      <Stack spacing={1} sx={{ padding: theme => theme.spacing(2, 3, 0) }}>
        {userId && <FollowButton />}

        <Box display="flex">
          <Typography variant="h6" color="textSecondary">
            happy {Weekdays[new Date().getDay()].toLowerCase()}{' '}
          </Typography>
          <span>
            <Button
              disabled={!!userId}
              aria-label="Open account menu"
              aria-controls="account-menu"
              aria-haspopup="true"
              onClick={menu.onOpen}
              size="large"
              variant="text"
              // Make it look like normal text
              sx={{
                padding: '6px 0',
                textTransform: 'lowercase',
                fontSize: theme => theme.typography.h6.fontSize,
                lineHeight: 1,
              }}
            >
              {user.displayName}!
            </Button>
          </span>
        </Box>

        {/** TODO: Drawer-ify this menu. */}
        <ClickAwayListener onClickAway={menu.onClose}>
          <span>
            <Menu
              id="account-menu"
              anchorEl={menu.ref}
              open={!!menu.ref}
              onClose={menu.onClose}
              MenuListProps={{ dense: true }}
            >
              <MenuItem
                onClick={() => {
                  history.push(Paths.library(user.uid));
                }}
              >
                Activity Library
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (!window.confirm('Sign out?')) return;
                  auth.signOut();
                }}
              >
                Sign out
              </MenuItem>
              <MenuItem onClick={deleteAccount}>
                <b>Delete account</b>
              </MenuItem>
            </Menu>
          </span>
        </ClickAwayListener>

        <Stack direction="row" spacing={2} sx={{ padding: theme => theme.spacing(1) }}>
          {!userId && (
            <Badge
              badgeContent={DataState.isReady(hasCheckedIn) && hasCheckedIn ? undefined : <b>!</b>}
              color="secondary"
            >
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={event => {
                  behaviorsDrawer.onOpen(event);
                }}
              >
                Behaviors
              </Button>
            </Badge>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={event => {
              newTrainingDrawer.onOpen(event);
            }}
          >
            Training
          </Button>
        </Stack>
      </Stack>

      {/** Behaviors Drawer UI */}
      <SwipeableDrawer
        anchor="right"
        {...behaviorsDrawer}
        PaperProps={{ sx: { padding: theme => theme.spacing(4), width: '85vw' } }}
      >
        <Stack spacing={3}>
          <Typography variant="overline" lineHeight={1}>
            Behaviors
          </Typography>
          <Button
            variant="contained"
            onClick={checkinDrawer.onOpen}
            endIcon={DataState.isReady(hasCheckedIn) && hasCheckedIn ? <b>!</b> : undefined}
            disabled={DataState.isReady(hasCheckedIn) && hasCheckedIn}
          >
            {DataState.isReady(hasCheckedIn) && hasCheckedIn ? 'Checked In' : 'Check In'}
          </Button>
          <Button variant="outlined" startIcon={<Add />} onClick={addEditBehaviorDrawer.onOpen}>
            New Behavior
          </Button>
          <DataStateView data={behaviors}>
            {behaviors => (
              <Stack spacing={1}>
                {behaviors.map(behavior => (
                  <Box
                    key={behavior.id}
                    sx={{ borderRadius: '8px', border: `1px solid ${Color.ActionSecondaryGray}` }}
                  >
                    <Stack
                      sx={{ padding: theme => theme.spacing(1) }}
                      onClick={event => {
                        setEditingBehavior(behavior);
                        // Controlled state for input on edit
                        setNewBehaviorName(behavior.name);
                        addEditBehaviorDrawer.onOpen(event);
                      }}
                    >
                      <Typography variant="body2">{behavior.name}</Typography>
                      <Rows pad={Pad.Medium}>
                        <Typography variant="body2" color="textSecondary">
                          Yes: {behavior.yesCount}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          No: {behavior.noCount}
                        </Typography>
                      </Rows>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </DataStateView>
        </Stack>
      </SwipeableDrawer>
      <SwipeableDrawer
        anchor="right"
        {...addEditBehaviorDrawer}
        PaperProps={{ sx: { padding: theme => theme.spacing(3), width: '85vw' } }}
        onClose={closeEditedDrawer}
      >
        <Stack spacing={2}>
          <Stack
            component="form"
            spacing={2}
            onSubmit={async event => {
              event.preventDefault(); // Prevent browser refresh
              try {
                // In editing mode
                if (editingBehavior) {
                  // Update DB
                  await db
                    .user(user.uid)
                    .collection(DbPath.UserBehaviors)
                    .doc(editingBehavior.id)
                    .update({ ...editingBehavior, name: newBehaviorName });
                  // Update local state to reflect changes in DB (if successful)
                  setBehaviors(
                    DataState.map(behaviors, state => {
                      const copy = state.slice();
                      copy[copy.indexOf(editingBehavior)].name = newBehaviorName;
                      return copy;
                    })
                  );
                } else {
                  // Create new behavior
                  const newEntry = Behavior.create({ authorId: user.uid, name: newBehaviorName });
                  const document = await db
                    .user(user.uid)
                    .collection(DbPath.UserBehaviors)
                    .add(newEntry);
                  const behavior = { id: document.id, ...newEntry };
                  // Update local state
                  setBehaviors(DataState.map(behaviors, state => state.concat(behavior)));
                }
                // Close modal
                closeEditedDrawer();
              } catch (err) {
                toast.error(err.message);
              }
            }}
          >
            <TextField
              fullWidth
              required
              autoFocus={!editingBehavior && addEditBehaviorDrawer.open}
              label="Behavior Name"
              value={newBehaviorName}
              onChange={event => setNewBehaviorName(event.target.value)}
            />
            <Button
              size="large"
              variant="outlined"
              disabled={!newBehaviorName}
              startIcon={<Save />}
              type="submit"
            >
              {editingBehavior ? 'Update' : 'Create'}
            </Button>
          </Stack>

          {/** Present delete button if in editing mode. */}
          {!!editingBehavior && (
            <Box display="flex" justifyContent="end">
              <IconButton
                size="small"
                sx={{ color: theme => theme.palette.error.main }}
                onClick={async () => {
                  if (!window.confirm('Delete this item?')) return;
                  try {
                    await db
                      .user(user.uid)
                      .collection(DbPath.UserBehaviors)
                      .doc(editingBehavior.id)
                      .delete();
                    // Update UI state to reflect changes
                    setBehaviors(
                      DataState.map(behaviors, _ => _.filter(_ => _.id !== editingBehavior.id))
                    );
                    // Close modal
                    closeEditedDrawer();
                  } catch (err) {
                    toast.error(err.message);
                  }
                }}
              >
                <Delete />
              </IconButton>
            </Box>
          )}
        </Stack>
      </SwipeableDrawer>
      <SwipeableDrawer
        anchor="right"
        {...checkinDrawer}
        PaperProps={{ sx: { padding: theme => theme.spacing(3), width: '85vw' } }}
      >
        <CheckinDrawer behaviors={behaviors} onClose={checkinDrawer.onClose} />
      </SwipeableDrawer>

      <SwipeableDrawer
        anchor="top"
        {...newTrainingDrawer}
        PaperProps={{ sx: { padding: theme => theme.spacing(3) } }}
      >
        <NewTrainingDrawer templates={templates} />
      </SwipeableDrawer>

      {/** List of TrainingLogs */}
      <DataStateView data={logs}>
        {logs => {
          return (
            <Box sx={{ padding: theme => theme.spacing(0, 3) }}>
              {/** TODO Why are there two DataStateView data={logs} ??? Fix this */}
              <DataStateView data={logs}>
                {logs => (
                  <Stack sx={{ overflowY: 'scroll', maxHeight: '50vh' }}>
                    <Columns pad={Pad.Medium}>
                      {logs.map(log => (
                        <Box
                          key={log.id}
                          sx={{ borderBottom: `1px solid ${Color.ActionSecondaryGray}` }}
                          onClick={() => history.push(Paths.logEditor(log.id))}
                        >
                          <Typography>{log.title}</Typography>
                          <Typography gutterBottom color="textSecondary" variant="body2">
                            {format(
                              (log.timestamp as firebase.firestore.Timestamp)?.toDate(),
                              Format.date + ', ' + Format.time
                            )}
                          </Typography>
                        </Box>
                      ))}
                    </Columns>
                  </Stack>
                )}
              </DataStateView>
            </Box>
          );
        }}
      </DataStateView>

      {/** List of templates */}
      <DataStateView data={templates}>
        {templates => {
          return (
            <>
              {templates.length ? (
                <Rows
                  pad={Pad.Medium}
                  className={css`
                    overflow-x: scroll;
                    overflow-y: hidden;
                    padding: 0 ${Pad.Large};
                  `}
                >
                  <>
                    {templates.map(t => (
                      <TrainingTemplatePreview key={t.id} template={t} />
                    ))}
                    <TrainingTemplateCreate />
                  </>
                </Rows>
              ) : (
                <TrainingTemplateCreate />
              )}
            </>
          );
        }}
      </DataStateView>
    </Columns>
  );
};

// const AccountStat: FC<{
//   progressValue: number;
//   title: string;
//   text: React.ReactNode;
// }> = ({ progressValue, title, text }) => {
//   return (
//     <Rows
//       center
//       pad={Pad.Small}
//       className={css`
//         border-radius: 16px;
//         border: 0;
//         padding: ${Pad.Small} ${Pad.Medium};
//         background-color: #fff;
//         box-shadow: 0 16px 32px rgba(0, 0, 0, 0.1);
//       `}
//     >
//       <CircularProgressWithLabel value={progressValue} />
//       <Columns center>
//         <Typography variant="subtitle2" color="textSecondary">
//           {title}
//         </Typography>
//         <Typography variant="h6" color="textPrimary">
//           {text}
//         </Typography>
//       </Columns>
//     </Rows>
//   );
// };

const NewTrainingDrawer: FC<{ templates: DataState<TrainingTemplate[]> }> = ({ templates }) => {
  /** The ID of the selected template, if there is one. */
  const [templateId, setTemplateId] = useState('');
  /** The controlled input of the new TrainingLog title. */
  const [title, setTitle] = useState(() => `${Weekdays[new Date().getDay()]} Training`);

  const user = useUser();
  const history = useHistory();

  const selectedTemplate: DataState<TrainingTemplate> = useMemo(
    () => DataState.map(templates, _ => _.find(t => t.id === templateId) ?? DataState.Empty),
    [templates, templateId]
  );

  // May (or may not) be a log created from a template.
  const createTrainingLog = useCallback(async () => {
    // const templateTitle = DataState.isReady(selectedTemplate) ? selectedTemplate.title : '';
    const templateId = DataState.isReady(selectedTemplate) ? selectedTemplate.id : null;
    const newLog = TrainingLog.create({
      title,
      authorId: user.uid,
      templateId,
    });
    try {
      const newLogRef = await db.user(user.uid).collection(DbPath.UserLogs).add(newLog);
      // Copy the activites to the new training log if using a template
      if (DataState.isReady(selectedTemplate)) {
        const logActivities = newLogRef.collection(DbPath.UserLogActivities);
        const batch = db.batch();
        const templateActivitiesSnapshot = await db
          .user(user.uid)
          .collection(DbPath.UserTemplates)
          .doc(selectedTemplate.id)
          .collection(DbPath.UserTemplateActivities)
          .withConverter(DbConverter.Activity)
          .get();
        // Create new Activity documents with the same data from the
        // Template but each their own custom ID
        templateActivitiesSnapshot.docs.forEach(templateActivityDoc => {
          const templateActivity = templateActivityDoc.data();
          const newLogActivityRef = logActivities.doc();
          const newLogActivityComments = newLogActivityRef
            .collection(DbPath.UserLogActivityComments)
            .withConverter(DbConverter.Comment);
          // Asynchronously copy comments from templateActivity to logActivity
          templateActivityDoc.ref
            .collection(DbPath.UserLogActivityComments)
            .withConverter(DbConverter.Comment)
            .get()
            .then(({ empty, docs }) => {
              if (empty) return; // No comments to copy over
              docs.forEach(commentDoc => {
                newLogActivityComments.add(commentDoc.data()).catch(error => {
                  toast.error(error.message);
                });
              });
            })
            .catch(error => {
              toast.error(error.message);
            });
          batch.set(newLogActivityRef, templateActivity);
          // Activities from templates have their history added to their linked
          // savedActivityId if it exists
          if (!!templateActivity.savedActivityId) {
            const ref: firebase.firestore.DocumentReference<SavedActivity> = db
              .user(user.uid)
              .collection(DbPath.UserTemplateActivities)
              .withConverter(DbConverter.SavedActivity)
              .doc(templateActivity.savedActivityId);
            ref
              .get()
              .then(doc => doc.data())
              .then(saved => {
                if (!saved) {
                  toast.error('Saved Activity not found.');
                  return;
                }
                // Add new Activity entry to SavedActivity.history
                const history = saved.history.concat({
                  activityId: templateActivity.id,
                  logId: templateActivity.logId,
                });
                // Update lastSeen field since this SavedActivity has been used again
                const lastSeen = firebase.firestore.FieldValue.serverTimestamp();
                return ref.set({ history, lastSeen }, { merge: true });
              })
              .catch(error => {
                toast.error(error.message);
              });
          }
        });
        const templateDocument = db
          .user(user.uid)
          .collection(DbPath.UserTemplates)
          .doc(selectedTemplate.id);
        // Add this log to the list of logs created from the selected template
        batch.update(templateDocument, {
          logIds: firebase.firestore.FieldValue.arrayUnion(newLogRef.id),
        });
        await batch.commit();
      }
      history.push(Paths.logEditor(newLogRef.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [selectedTemplate, title, user.uid, history]);

  return (
    <Stack spacing={4} width="100%" sx={{ margin: '1rem 0' }}>
      <FormControl disabled={!DataState.isReady(templates)}>
        <InputLabel htmlFor="template-helper">Training Templates</InputLabel>
        <NativeSelect
          value={templateId}
          // Setting the ID selects the template
          onChange={event => setTemplateId(event.target.value)}
          inputProps={{
            name: 'Training Template',
            id: 'template-helper',
          }}
        >
          <option aria-label="None" value=""></option>
          <DataStateView data={templates} error={() => null} loading={() => null}>
            {templates =>
              !!templates.length ? (
                <>
                  {Array.from(templates.values()).map(template => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </>
              ) : (
                <option aria-label="None" value="">
                  No templates!
                </option>
              )
            }
          </DataStateView>
        </NativeSelect>
      </FormControl>

      <TextField
        fullWidth
        required
        autoFocus
        disabled={typeof title !== 'string' || title === ''}
        // variant="standard"
        label="Title"
        value={title}
        onChange={event => {
          setTitle(event.target.value);
        }}
      />

      <Button variant="contained" color="primary" onClick={createTrainingLog} size="large">
        New Training
      </Button>
    </Stack>
  );
};

/**
 * An answer to a user-generated question about their own behavior/habits.
 * Null represents unanswered/initial state.
 */
type Answer = 'yes' | 'no' | null;

const CheckinDrawer: FC<{
  behaviors: DataState<Behavior[]>;
  onClose(): void;
}> = ({ behaviors, onClose }) => {
  const user = useUser();

  const [isHighStressDay, setIsHighStressDay] = useState(false);
  // A map of each behavior as keys and yes/no/unanswered as values
  const [form, setForm] = useState<Map<Behavior, Answer>>(new Map());

  // Set the initial state of the form map data based on the given `behaviors` prop
  useEffect(() => {
    if (!DataState.isReady(behaviors)) return;
    const initialState = new Map<Behavior, Answer>();
    behaviors.forEach(behavior => {
      initialState.set(behavior, null);
    });
    setForm(initialState);
  }, [behaviors]);

  const completeCheckin = useCallback(async () => {
    if (!DataState.isReady(behaviors)) return;
    try {
      // Batch: 1) creating the checkin; 2) incrementing the yes/no count for each Behavior
      const batch = db.batch();
      // Create a new version of the behaviors data with yes/no increment/decremented
      const incremented = behaviors.map(behavior => {
        const answer = form.get(behavior);
        let updateData: Partial<Pick<Behavior, 'yesCount' | 'noCount'>> = {};
        // Increment behavior yes/no counts based on the answer
        if (answer === 'yes') {
          behavior.yesCount++;
          updateData.yesCount = behavior.yesCount;
        }
        if (answer === 'no') {
          behavior.noCount++;
          updateData.noCount = behavior.noCount;
        }
        batch.update(
          db.user(user.uid).collection(DbPath.UserBehaviors).doc(behavior.id),
          updateData
        );
        return behavior;
      });
      // Patch together list of updated yes/no behaviors with rest of the checkin info
      const checkinEntry: Omit<Checkin, 'id'> = {
        behaviors: incremented,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        isHighStressDay,
      };
      // Create a new document and set checkinEntry as the data
      batch.set(db.user(user.uid).collection(DbPath.UserCheckins).doc(), checkinEntry);
      // Fire it off
      await batch.commit();
      // Display success message
      toast.success('Checkin-in complete for today!');
    } catch (err) {
      toast.error(err.message);
    }
    // Close the UI
    onClose();
  }, [behaviors, form, isHighStressDay, onClose, user.uid]);

  return (
    <Stack spacing={4} width="100%">
      <Typography variant="overline" lineHeight={1}>
        <b>{format(new Date(), Format.date)} Check-in</b>
      </Typography>
      <Box width="100%">
        <FormControlLabel
          control={
            <Switch
              checked={isHighStressDay}
              onChange={event => setIsHighStressDay(event.target.checked)}
            />
          }
          label="High stress day?"
          labelPlacement="end"
        />
      </Box>
      <Typography variant="overline" lineHeight={1} color="textSecondary">
        For each question, did it improve training quality/ability?
      </Typography>
      {Array.from(form.entries()).map(([behavior, answer]) => {
        return (
          <Stack
            direction="row"
            spacing={2}
            width="100%"
            alignItems="center"
            justifyContent="space-between"
            key={behavior.id}
          >
            <Typography>{behavior.name}</Typography>
            <ToggleButtonGroup
              exclusive
              value={answer ?? undefined}
              onChange={(_, newAnswer: Answer) => {
                setForm(map => {
                  const next = new Map(map);
                  next.set(behavior, newAnswer);
                  return next;
                });
              }}
              aria-label="Behavior occurred"
            >
              <ToggleButton value="yes" aria-label="yes">
                Yes
              </ToggleButton>
              <ToggleButton value="no" aria-label="no">
                No
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        );
      })}
      <Button
        variant="contained"
        endIcon={<Check />}
        disabled={!DataState.isReady(behaviors) || Array.from(form.values()).includes(null)}
        onClick={completeCheckin}
      >
        Complete
      </Button>
    </Stack>
  );
};

const FollowButton: FC = () => {
  /** The ID of the selected user. Is `undefined` if viewing our own page. */
  const { userId } = useParams<{ userId?: string }>();
  const user = useUser();

  const [isFollowing, setIsFollowing] = useState<DataState<boolean>>(DataState.Empty);

  // Define `isFollowing` and keep its value up-to-date
  useEffect(() => {
    if (!userId) return;
    return db.user(user.uid).onSnapshot(
      doc => {
        const following = doc.get('following') as string[];
        setIsFollowing(following.includes(userId));
      },
      err => setIsFollowing(DataState.error(err.message))
    );
  }, [userId, user.uid]);

  const toggleFollow = useCallback(async () => {
    if (!userId || !DataState.isReady(isFollowing)) return;
    try {
      const batch = db.batch();
      // Add/remove the authenticated user to/from the viewed users followers
      batch.update(db.user(userId), {
        followers: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(user.uid)
          : firebase.firestore.FieldValue.arrayUnion(user.uid),
      });
      // Add/remove the viewed user to/from the authenticated users follow list
      batch.update(db.user(user.uid), {
        following: isFollowing
          ? firebase.firestore.FieldValue.arrayRemove(userId)
          : firebase.firestore.FieldValue.arrayUnion(userId),
      });
      await batch.commit();
    } catch (error) {
      toast.error(error.message);
    }
  }, [userId, user.uid, isFollowing]);

  return (
    <Button variant="text" onClick={toggleFollow} size="small">
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
};

// const CircularProgressWithLabel: FC<{ value: number }> = ({ value }) => {
//   return (
//     <Box position="relative" display="inline-flex">
//       <CircularProgress
//         variant="determinate"
//         value={100}
//         size={45}
//         thickness={3}
//         className={css`
//           color: #ddd !important;
//         `}
//       />
//       <CircularProgress
//         variant="determinate"
//         value={value}
//         size={45}
//         thickness={4}
//         className={css`
//           position: absolute;
//           left: 0;
//           color: ${Color.ActionPrimaryBlue} !important;
//         `}
//       />
//       <Box
//         top={0}
//         left={0}
//         bottom={0}
//         right={0}
//         position="absolute"
//         display="flex"
//         alignItems="center"
//         justifyContent="center"
//       >
//         <Typography
//           variant="caption"
//           component="div"
//           color="textPrimary"
//           className={css`
//             // Nudge to center
//             margin-bottom: 0 !important;
//           `}
//         >
//           <b>{`${Math.round(value)}%`}</b>
//         </Typography>
//       </Box>
//     </Box>
//   );
// };

const TrainingTemplatePreview: FC<{
  template: TrainingTemplate;
}> = ({ template }) => {
  const history = useHistory();
  const user = useUser();

  const navigateToTemplate = useCallback(() => {
    const templatePath =
      template.authorId === user.uid
        ? Paths.templateEditor(template.id)
        : Paths.templateView(template.authorId, template.id);
    history.push(templatePath);
  }, [user.uid, template, history]);

  /** Total volume calculated for each log in `template.logIds`. */
  // const [templateLogVolumes] = useDataState(
  //   () =>
  //     Promise.all(
  //       template.logIds.map(logId =>
  //         db
  //           .user(user.uid)
  //           .collection(DbPath.UserLogs)
  //           .doc(logId)
  //           .collection(DbPath.UserLogActivities)
  //           .withConverter(DbConverter.Activity)
  //           .get()
  //           .then(snapshot => ({
  //             volume: snapshot.docs
  //               .map(doc => Activity.getVolume(doc.data()))
  //               .reduce((sum, v) => sum + v, 0),
  //           }))
  //       )
  //     ),
  //   [user.uid, template.logIds]
  // );

  // const [latestLogDate] = useDataState(async () => {
  //   if (template.logIds.length === 0) return DataState.Empty;
  //   // All the Dates of logs created from this template
  //   const promises = template.logIds.map(logId =>
  //     db
  //       .user(user.uid)
  //       .collection(DbPath.UserLogs)
  //       .doc(logId)
  //       .get()
  //       .then(doc => {
  //         // `t` could be undefined
  //         const t: TrainingLog['timestamp'] = doc.get('timestamp');
  //         return (t as firebase.firestore.Timestamp)?.toDate();
  //       })
  //   );
  //   const logDates = await Promise.all(promises);
  //   // Convert dates to number to please the TypeScript machine
  //   const sorted = logDates.filter(_ => _ !== void 0).sort((a, b) => +b - +a);
  //   if (sorted.length === 0) return DataState.Empty;
  //   return formatDistanceToNowStrict(sorted[0], { addSuffix: true });
  // }, [user.uid, template]);

  return (
    <Columns
      pad={Pad.Small}
      className={css`
        border: 0;
        border-radius: 20px;
        padding: ${Pad.Medium};
        background-color: #fff;
        min-width: 65vw;
        min-height: 150px;
        border: 1px solid ${Color.ActionPrimaryGray};
      `}
      onClick={navigateToTemplate}
    >
      <Rows center pad={Pad.Medium}>
        <div
          className={css`
            background-color: ${baseBg};
            border-radius: 20px;
            padding: ${Pad.Medium};
          `}
        >
          <Typography variant="body2" color="textSecondary">
            {TrainingLog.abbreviate(template.title)}
          </Typography>
        </div>
        <Columns>
          <Typography variant="body1" color="textPrimary">
            <b>{template.title}</b>
          </Typography>
          {/**DataState.isReady(latestLogDate) && (
            <Typography variant="caption" color="textSecondary">
              {latestLogDate}
            </Typography>
          )*/}
        </Columns>
        <ChevronRight
          className={css`
            color: ${Color.ActionPrimaryBlue} !important;
            margin-left: auto;
          `}
        />
      </Rows>
      <Rows center pad={Pad.Medium}>
        {/**template.logIds.length > 1 && (
          <DataStateView data={templateLogVolumes}>
            {templateLogVolumes => (
              <LineChart height={60} width={80} data={templateLogVolumes}>
                <Line type="monotone" dot={false} dataKey="volume" strokeWidth={2} stroke="green" />
              </LineChart>
            )}
          </DataStateView>
        )*/}
        {!!template.logIds.length && (
          <Rows
            pad={Pad.XSmall}
            className={css`
              align-items: center !important;
            `}
          >
            <Typography variant="h4" color="textPrimary">
              {template.logIds.length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Log{template.logIds.length === 1 ? '' : 's'}
            </Typography>
          </Rows>
        )}
      </Rows>
    </Columns>
  );
};

// const isLeapYear = (year: number): boolean =>
//   (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * @note When passing `monthIndex` remember that January is index 0.
 * @example const februaryDaysCount = getMonthLength(new Date(), 1)
 */
// const getMonthLength = (now: Date, monthIndex: number): number => {
//   const year = now.getFullYear();
//   const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
//   return lengths[monthIndex];
// };

/**
 * Presents an active, clickable calendar date ("11") if a `logId` prop is
 * given, otherwise a neutral, non-interactable date display.
 *
 * Calendar dates with logs for those days display Popover menus onClick.
 */
// const TrainingCalendarLog: FC<{
//   dayOfMonth: number;
//   /** If present, there is a TrainingLog associated with the given date. */
//   logId?: string;
// }> = ({ dayOfMonth, logId }) => {
//   const history = useHistory();
//   const { userId } = useParams<{ userId?: string }>();
//   const user = useUser();

//   const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

//   const open = !!anchorEl;
//   const id = open ? 'training-log-popover' : undefined;

//   const nowDay = new Date().getDate() - 1;

//   /**
//    * The TrainingLog data for the log for this data, if it exists.
//    * This is always `DataState.Empty` if the Popover is never opened.
//    */
//   const [log] = useDataState(async () => {
//     // nah
//     if (!open) return DataState.Empty;
//     // fetch the log, the thing is open
//     const data = await db
//       .user(userId ?? user.uid)
//       .collection(DbPath.UserLogs)
//       .withConverter(DbConverter.TrainingLog)
//       .doc(logId)
//       .get()
//       .then(doc => doc.data());
//     if (!data) return DataState.error('Log not found');
//     return data;
//   }, [open, logId, userId, user.uid]);

//   // How many times have we done this?
//   const logDate = DataState.map(log, l => (l.timestamp as firebase.firestore.Timestamp)?.toDate());

//   return (
//     <IconButton
//       disableRipple
//       className={css`
//         /** Up to seven items per row */
//         flex-basis: 14.28% !important;
//         padding: 0 !important;

//         & p {
//           padding: ${Pad.Small} 0 !important;
//           width: 5ch;
//           ${dayOfMonth === nowDay && `text-decoration: underline;`}
//         }
//       `}
//       onClick={logId ? event => setAnchorEl(event.currentTarget) : undefined}
//     >
//       {logId ? (
//         <>
//           <Popover
//             id={id}
//             open={open}
//             anchorEl={anchorEl}
//             onClose={() => setAnchorEl(null)}
//             anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
//             transformOrigin={{ vertical: 'center', horizontal: 'center' }}
//           >
//             <ClickAwayListener onClickAway={() => setAnchorEl(null)}>
//               <Columns
//                 pad={Pad.Small}
//                 className={css`
//                   padding: ${Pad.Medium};
//                 `}
//               >
//                 <DataStateView data={DataState.all(log, logDate)}>
//                   {([log, logDate]) => (
//                     <>
//                       <Rows pad={Pad.Medium} center>
//                         <Columns
//                           center
//                           className={css`
//                             background-color: ${baseBg};
//                             border-radius: 20px;
//                             padding: ${Pad.Small} ${Pad.Medium};
//                             font-weight: 600 !important;
//                           `}
//                         >
//                           <Typography variant="overline" color="textSecondary">
//                             {Months[logDate.getMonth()].slice(0, 3)}
//                           </Typography>
//                           <Typography variant="body1" color="textSecondary">
//                             {logDate.getDate()}
//                           </Typography>
//                         </Columns>
//                         <Columns>
//                           <Typography variant="body1" color="textPrimary">
//                             {log.title}
//                           </Typography>
//                           <Typography variant="caption" color="textSecondary">
//                             {formatDistanceToNowStrict(logDate, {
//                               addSuffix: true,
//                             })}
//                           </Typography>
//                         </Columns>
//                       </Rows>
//                       <Button
//                         variant="contained"
//                         color="primary"
//                         onClick={() => history.push(Paths.logEditor(logId))}
//                         size="large"
//                       >
//                         Go
//                         <ChevronRight fontSize="small" />
//                       </Button>
//                     </>
//                   )}
//                 </DataStateView>
//               </Columns>
//             </ClickAwayListener>
//           </Popover>
//           <Typography
//             aria-describedby={id}
//             variant="body1"
//             className={css`
//               color: ${Color.ActionPrimaryBlue};
//               background-color: ${baseBg};
//               border-radius: 50%;
//               box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
//             `}
//           >
//             {dayOfMonth + 1}
//           </Typography>
//         </>
//       ) : (
//         <Typography variant="body1" color="textSecondary">
//           {dayOfMonth + 1}
//         </Typography>
//       )}
//     </IconButton>
//   );
// };

const TrainingTemplateCreate: FC = () => {
  const user = useUser();
  const history = useHistory();

  const createTemplate = useCallback(async () => {
    const title = window.prompt('Template title...');
    if (!title) return;
    try {
      const docRef = await db
        .user(user.uid)
        .collection(DbPath.UserTemplates)
        .add(TrainingTemplate.create({ authorId: user.uid, title }));
      history.push(Paths.templateEditor(docRef.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, history]);

  return (
    <Columns
      pad={Pad.Small}
      className={css`
        border: 0;
        background-color: #fff;
        border-radius: 20px;
        padding: ${Pad.Medium};
      `}
      onClick={createTemplate}
    >
      <Columns center pad={Pad.Medium}>
        <Rows center pad={Pad.Large}>
          <Typography variant="body1" color="textSecondary">
            Create Template
          </Typography>
          <ChevronRight
            fontSize="small"
            className={css`
              color: ${Color.ActionPrimaryBlue} !important;
              margin-left: auto;
            `}
          />
        </Rows>
        <div
          className={css`
            background-color: ${baseBg};
            border-radius: 20px;
            padding: ${Pad.Medium};
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
          `}
        >
          <Typography variant="body1" color="textSecondary">
            <Add fontSize="small" htmlColor={Color.ActionPrimaryBlue} />
          </Typography>
        </div>
      </Columns>
    </Columns>
  );
};

import { css } from '@emotion/css';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
} from '@material-ui/core';
import { Add, Menu as MenuIcon } from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import FlipMove from 'react-flip-move';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  ActivityNameBold,
  ActivityView,
  activityViewContainerStyle,
  createTemplateFromLog,
} from '../components';
import { Format, Months, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import {
  Activity,
  ActivityRepCountUnit,
  ActivitySetStatus,
  ActivityWeightUnit,
  SavedActivity,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { baseBg, Color, Pad, Rows } from '../style';

export const TrainingLogEditor: FC = () => {
  const listRef = useRef<HTMLDivElement | null>(null);
  // const logNotesRef = useRef<HTMLTextAreaElement | null>(null);
  // Do not show the activity input by default
  const [activityName, setActivityName] = useState('');

  const [log, setLog] = useState<DataState<TrainingLog | TrainingTemplate>>(DataState.Loading);

  /** Controlled state for `TrainingLog.notes` */
  // const [logNotes, setLogNotes] = useState<DataState<string>>(DataState.Empty);

  /** Live data from DbPath.Activity collection snapshots. */
  const [activities, setActivities] = useState<DataState<Activity[]>>(DataState.Loading);

  const menu = useMaterialMenu();

  // Skip the `ref` prop since <SwipeableDrawer /> does not use it.
  const { ref: _ref, ...addActivityDrawer } = useMaterialMenu();
  const _onClose = addActivityDrawer.onClose;
  // Overwrite/overload `onClose` to also set `activityName` to empty string.
  Object.assign(addActivityDrawer, {
    onClose: () => {
      _onClose();
      // Clear name, using tick-delay to avoid a visual flickering bug.
      Promise.resolve().then(() => {
        setActivityName('');
      });
    },
  });

  const history = useHistory();
  const user = useUser();

  const { logId, templateId } = useParams<{
    logId?: string;
    templateId?: string;
  }>();

  const isTemplate = !!templateId;

  // Fetch activities and observe live updates
  useEffect(() => {
    if (!DataState.isReady(log)) return;
    return db
      .user(log.authorId)
      .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
      .doc(log.id)
      .collection(DbPath.UserLogActivities)
      .withConverter(DbConverter.Activity)
      .orderBy('position', 'asc')
      .onSnapshot(
        snapshot =>
          setActivities(
            snapshot.docs.map(doc => {
              const activity = doc.data();
              // Patch the fields not present in old data
              if (!activity?.repCountUnit) activity.repCountUnit = ActivityRepCountUnit.Repetitions;
              if (!activity?.weightUnit) activity.weightUnit = ActivityWeightUnit.Pounds;
              if (!activity?.isFavorite) activity.isFavorite = false;
              return activity;
            })
          ),
        error => setActivities(DataState.error(error.message))
      );
  }, [log, isTemplate]);

  // Subscribe to updates to the TrainingLog/Template ID from the URL
  useEffect(() => {
    if (!logId && !templateId) {
      toast.error('No logId or templateId given in URL.');
      return;
    }
    return db
      .user(user.uid)
      .collection(templateId ? DbPath.UserTemplates : DbPath.UserLogs)
      .withConverter(templateId ? DbConverter.TrainingTemplate : DbConverter.TrainingLog)
      .doc(templateId ?? logId)
      .onSnapshot(
        doc => {
          const log = doc.data();
          setLog(log ?? DataState.error('Unexpected: Log not found.'));
          // if (log?.notes?.length) setLogNotes(log.notes);
        },
        err => setLog(DataState.error(err.message))
      );
  }, [user.uid, logId, templateId]);

  // const addActivity = useCallback(
  //   async <E extends React.SyntheticEvent>(event: E) => {
  //     event.preventDefault();
  //     if (!activityName?.length || !DataState.isReady(log)) return;
  //     const name = activityName;
  //     // Hide the input
  //     addActivityDrawer.onClose();
  //     try {
  //       const activitiesColl = db
  //         .user(user.uid)
  //         .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
  //         .doc(log.id)
  //         .collection(DbPath.UserLogActivities);
  //       const { docs } = await activitiesColl.orderBy('position', 'desc').limit(1).get();
  //       const prevMaxPosition: number = docs[0]?.get('position') ?? 0;
  //       const entry = Activity.create({
  //         name,
  //         position: prevMaxPosition + 1,
  //         logId: log.id,
  //         timestamp: log.timestamp,
  //         sets: [],
  //         weightUnit: ActivityWeightUnit.Pounds,
  //         repCountUnit: ActivityRepCountUnit.Repetitions,
  //       });
  //       const { id } = await activitiesColl.add(entry);
  //       // Scroll new item into view
  //       document.getElementById(`activity-${id}`)?.scrollIntoView();
  //     } catch (error) {
  //       // @ts-ignore
  //       toast.error(error.message);
  //     }
  //   },
  //   [activityName, log, user.uid, isTemplate, addActivityDrawer]
  // );

  // const updateLogNotes = useCallback(async () => {
  //   if (!DataState.isReady(log)) return;
  //   if (logNotes === '') setLogNotes(DataState.Empty);
  //   try {
  //     db.user(user.uid)
  //       .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
  //       .doc(log.id)
  //       .update({ notes: logNotes } as Partial<TrainingLog>);
  //   } catch (error) {
  //     // @ts-ignore
  //     toast.error(error.message);
  //   }
  // }, [user.uid, log, logNotes, isTemplate]);

  /**
   * Add SavedActivity.history Activity to TrainingLog activities and
   * insert the new activity into the history.
   */
  const addFromLibrary = useCallback(
    /** @param activity Only need valid: sets, name, repCountUnit, weightUnit */
    async (activity: Activity, saved: SavedActivity) => {
      if (!DataState.isReady(activities) || !DataState.isReady(log)) {
        toast.warn('Data not ready.');
        return;
      }
      // Hide the input
      addActivityDrawer.onClose();
      setActivityName('');
      try {
        const prevMaxPosition = activities[activities.length - 1]?.position ?? 0;
        // Get list of sets with status reset
        const sets = activity.sets.map(s => {
          s.status = ActivitySetStatus.Unattempted;
          return s;
        });
        const newActivity = Activity.create({
          name: activity.name,
          sets,
          position: prevMaxPosition + 1,
          logId: log.id,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          weightUnit: activity.weightUnit,
          repCountUnit: activity.repCountUnit,
        });
        // Add Activity to the current TrainingLog and get its ID
        const { id: activityId } = await db
          .user(user.uid)
          .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
          .doc(log.id)
          .collection(DbPath.UserLogActivities)
          .add(newActivity);
        // Add new Activity entry to SavedActivity.history
        const history = saved.history.concat({ activityId, logId: log.id });
        // Update lastSeen field since this SavedActivity has been used again
        const lastSeen = firebase.firestore.FieldValue.serverTimestamp();
        await db
          .user(user.uid)
          .collection(DbPath.UserActivityLibrary)
          .withConverter(DbConverter.SavedActivity)
          .doc(saved.id)
          .set({ history, lastSeen }, { merge: true });
      } catch (error) {
        // @ts-ignore
        toast.error(error.message);
      }
    },
    [activities, isTemplate, log, user.uid, addActivityDrawer]
  );

  /** #region log title menu actions */
  const renameLog = useCallback(() => {
    if (!DataState.isReady(log)) return;
    menu.onClose();
    const title = window.prompt('Update title', log.title);
    if (!title) return;
    try {
      db.user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .set({ title } as Pick<TrainingLog, 'title'>, { merge: true });
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [log, isTemplate, menu]);

  const openPreviousLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open previous log?')) return;
    menu.onClose();
    try {
      const { docs } = await db
        .user(user.uid)
        .collection(templateId ? DbPath.UserTemplates : DbPath.UserLogs)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .startAfter(log.timestamp)
        .get();
      const doc = docs[0];
      if (!doc) {
        toast.warn('No log found');
        return;
      }
      const path = templateId ? Paths.templateEditor(doc.id) : Paths.logEditor(doc.id);
      history.push(path);
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [user.uid, log, history, templateId, menu]);

  const openNextLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open next log?')) return;
    menu.onClose();
    try {
      const { docs } = await db
        .user(user.uid)
        .collection(templateId ? DbPath.UserTemplates : DbPath.UserLogs)
        .orderBy('timestamp', 'asc')
        .limit(1)
        .startAfter(log.timestamp)
        .get();
      const doc = docs[0];
      if (!doc) {
        toast.warn('No log found');
        return;
      }
      const path = templateId ? Paths.templateEditor(doc.id) : Paths.logEditor(doc.id);
      history.push(path);
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [user.uid, log, history, templateId, menu]);

  const createTemplate = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    menu.onClose();
    if (isTemplate) return;
    if (!window.confirm('Create a Template from this log?')) return;
    try {
      const newTemplateId = await createTemplateFromLog(log, user.uid);
      if (window.confirm('Delete original log?')) {
        const logDoc = db
          .user(user.uid)
          .collection(DbPath.UserLogs)
          .withConverter(DbConverter.TrainingLog)
          .doc(log.id);
        await logDoc.delete();
        toast.info('Deleted original log.');
      } else {
        // add log to template history
        await db
          .user(user.uid)
          .collection(DbPath.UserTemplates)
          .withConverter(DbConverter.TrainingTemplate)
          .doc(newTemplateId)
          .update({ logIds: firebase.firestore.FieldValue.arrayUnion(log.id) });
      }
      history.push(Paths.templateEditor(newTemplateId));
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [log, user.uid, history, isTemplate, menu]);

  const deleteLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm(`Delete "${log.title}" forever?`)) return;
    menu.onClose();
    try {
      await db
        .user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .delete();
      // Deleting log deletes it from `templateIds` if it was in a
      // TrainingTemplate.
      if ('templateId' in log && typeof log.templateId === 'string') {
        // Creating a log from a template will add a property on the log
        // which distinguishes it from a template. This way we can check here.
        await db
          .user(log.authorId)
          .collection(DbPath.UserTemplates)
          .withConverter(DbConverter.TrainingTemplate)
          .doc(log.templateId)
          .update({ logIds: firebase.firestore.FieldValue.arrayRemove(log.id) });
      }

      const logType = isTemplate ? 'Template' : 'Log';
      toast.info(`${logType} deleted.`);
      history.goBack();
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [log, history, isTemplate, menu]);
  /** #endregion */

  return (
    <DataStateView data={log}>
      {log => (
        <Box
          sx={{
            height: '100%',
            backgroundColor: baseBg,
            padding: '3.25rem 0',
          }}
        >
          {/** LOG TITLE MENU BUTTON */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              zIndex: 999,
              backgroundColor: 'transparent',
              padding: '0.5rem',
            }}
          >
            <Button
              disableRipple
              fullWidth
              aria-label="Log title and log menu button"
              aria-controls="log-menu-button"
              aria-haspopup="true"
              onClick={menu.onOpen}
              variant="text"
              startIcon={<MenuIcon />}
              size="large"
              sx={{
                backgroundColor: 'white',
              }}
            >
              {log.title}
            </Button>
          </Box>

          {/** LOG TITLE MENU ACTIONS */}
          <Menu
            id="log-menu"
            anchorEl={menu.ref}
            open={!!menu.ref}
            onClose={menu.onClose}
            MenuListProps={{ dense: true }}
          >
            <MenuItem onClick={openPreviousLog}>Go to previous log</MenuItem>
            <MenuItem onClick={openNextLog}>Go to next log</MenuItem>
            <MenuItem onClick={renameLog}>Edit name</MenuItem>
            {/* <MenuItem
              onClick={() => {
                if (DataState.isReady(logNotes) && logNotes) {
                  logNotesRef.current?.focus();
                  return;
                }
                // Unhide the notes input
                setLogNotes('');
                Promise.resolve().then(() => logNotesRef.current?.focus());
              }}
            >
              Add notes
            </MenuItem> */}
            {!!window.navigator.share && (
              <MenuItem
                onClick={() => {
                  menu.onClose();
                  const url = isTemplate
                    ? Paths.templateView(log.authorId, log.id)
                    : Paths.logView(log.authorId, log.id);
                  window.navigator.share({ url });
                }}
              >
                Share link
              </MenuItem>
            )}
            {!isTemplate && <MenuItem onClick={createTemplate}>Create Template</MenuItem>}
            <MenuItem onClick={deleteLog}>
              <b>Delete Training {isTemplate ? 'Template' : 'Log'}</b>
            </MenuItem>
          </Menu>

          {/** LIST OF ACTIVITIES */}
          <DataStateView data={activities}>
            {activities => (
              <>
                <Box ref={listRef} height="100%">
                  <FlipMove
                    enterAnimation="fade"
                    leaveAnimation="fade"
                    className={css`
                      height: 100%;
                      width: 100%;
                      overflow-y: scroll;
                      ${activityViewContainerStyle}
                      padding: 0;
                    `}
                  >
                    {activities.map(({ id }, index) => (
                      <ActivityView
                        key={id}
                        editable
                        activities={activities}
                        index={index}
                        log={log}
                      />
                    ))}
                  </FlipMove>
                </Box>

                {/** ADD ACTIVITY BUTTON */}
                <Box display="flex" width="100%" sx={{ padding: '0 1rem' }}>
                  <Button
                    fullWidth
                    disableRipple
                    startIcon={<Add />}
                    variant="outlined"
                    sx={{
                      backgroundColor: 'white',
                    }}
                    onClick={event => {
                      // Trigger the add activity drawer to open
                      addActivityDrawer.onOpen(event);
                    }}
                  >
                    Activity
                  </Button>
                </Box>
              </>
            )}
          </DataStateView>

          <Box
            sx={{
              position: 'fixed',
              top: 12,
              backgroundColor: 'transparent',
              left: 0,
              padding: '0.5rem',
              width: '100%',
              zIndex: 999,
            }}
          >
            <EditorControlsDateView log={log} />
            {DataState.isReady(activities) && activities.length > 1 && (
              <Typography
                variant="overline"
                color="textSecondary"
                sx={{ lineHeight: 1, position: 'absolute', bottom: '0.5rem', left: '0.5rem' }}
              >
                Total Vol{' '}
                {Intl.NumberFormat().format(
                  activities.map(Activity.getVolume).reduce((sum, v) => sum + v, 0)
                )}
              </Typography>
            )}
          </Box>

          {/** Add Activity Drawer */}
          <SwipeableDrawer
            anchor="bottom"
            {...addActivityDrawer}
            PaperProps={{ sx: { padding: theme => theme.spacing(3) } }}
          >
            <Stack spacing={2}>
              <Box sx={{ maxHeight: '30vh', overflowY: 'scroll' }}>
                <LibraryAutocomplete
                  query={activityName}
                  setActivityName={(name: string) => setActivityName(name)}
                  addFromLibrary={addFromLibrary}
                />
              </Box>
              <TextField
                fullWidth
                variant="standard"
                label="Search Activity..."
                autoFocus={addActivityDrawer.open}
                value={activityName}
                onChange={event => {
                  setActivityName(event.target.value);
                }}
              />
            </Stack>
          </SwipeableDrawer>
        </Box>
      )}
    </DataStateView>
  );
};

/**
 * Renders the `SavedActivity` entries from the users Library. Allows the user
 * to filter entries via `query` and select one to add an Activity with data
 * (like weightUnit) autocompleted from the selected Library entry. If no
 * entries match the given `query`, a button is presented to create one with
 * `query` as the activity name.
 */
const LibraryAutocomplete: FC<{
  query: string;
  setActivityName(name: string): void;
  addFromLibrary(a: Activity, saved: SavedActivity): void;
}> = ({ query, setActivityName, addFromLibrary }) => {
  const user = useUser();

  // SavedActivity's matching the query
  const [queriedActivites] = useDataState(
    () =>
      db
        .user(user.uid)
        .collection(DbPath.UserActivityLibrary)
        .withConverter(DbConverter.SavedActivity)
        .orderBy('name', 'asc') // TODO Sort manually using a.localCompare(b)
        .get()
        .then(snapshot =>
          // Skip saved activities that do not match the queried name
          snapshot.docs.flatMap(doc => {
            const sa: SavedActivity = doc.data();
            // Firebase does not give an elegant way to filter this way
            // TODO Create normalized field on SavedActivity.name so it can
            // support being searched
            if (sa.name.toLowerCase().includes(query.toLowerCase())) {
              return [sa];
            }
            return [];
          })
        )
        .then(savedActivities => {
          savedActivities.forEach(_ => console.log(_.lastSeen))
          // Sort array by frequency - size of history
          const byFrequency = savedActivities.sort((a, b) => {
            if (!a.history.length || !b.history.length) return NaN;
            if (a.history.length === b.history.length) return 0;
            return a.history.length > b.history.length ? -1 : 1;
          });
          // Sort array by recency - most recent lastSeen timestamp
          const byRecency = byFrequency.sort((a, b) => {
            if (!a.lastSeen || !b.lastSeen) return NaN;
            if (a.lastSeen === b.lastSeen) return 0;
            return a.lastSeen > b.lastSeen ? -1 : 1;
          });
          return byRecency;
        }),
    [query, user.uid]
  );

  const createSavedActivity = useCallback(async () => {
    try {
      // Create the Library entry and get its data.
      const libraryEntry = await db
        .user(user.uid)
        .collection(DbPath.UserActivityLibrary)
        .withConverter(DbConverter.SavedActivity)
        .add(SavedActivity.create({ name: query }) as SavedActivity)
        .then(docRef => docRef.get())
        .then(docSnapshot => docSnapshot.data());
      if (!libraryEntry) {
        throw Error('Unexpected: Could not add to Library.');
      }
      const newActivity = Activity.create({
        name: query,
        repCountUnit: ActivityRepCountUnit.Repetitions,
        weightUnit: ActivityWeightUnit.Pounds,
        sets: [],
        /**  In this case, these fields do not matter. @see addFromLibrary */
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        logId: '',
        position: 0,
      }) as Activity;
      addFromLibrary(newActivity, libraryEntry);
      // Set the input state to the query value so that LibraryAutocomplete
      // renders just the autocomplete options for that exact new input
      setActivityName(query);
    } catch (error) {
      // @ts-ignore
      toast.error(error.message);
    }
  }, [user.uid, addFromLibrary, query, setActivityName]);

  // TODO - Add X button to activity input to clear it instantly
  return (
    <DataStateView data={queriedActivites}>
      {queriedActivites => {
        if (queriedActivites.length > 1) {
          return (
            <Stack spacing={1}>
              {queriedActivites.map(savedActivity => (
                <Box
                  display="flex"
                  width="100%"
                  sx={{
                    borderRadius: '8px',
                    backgroundColor: '#eee',
                    border: '1px solid #ddd',
                    padding: '0.5rem 1.0rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => setActivityName(savedActivity.name)}
                >
                  <Box key={savedActivity.id}>
                    <ActivityNameBold name={savedActivity.name} />
                    <Typography color="textSecondary" variant="subtitle2">
                      {savedActivity.history.length} logs
                    </Typography>
                  </Box>
                  <Add />
                </Box>
              ))}
            </Stack>
          );
        }
        if (queriedActivites.length === 1) {
          return (
            <LibraryMenuSavedActivityView
              savedActivity={queriedActivites[0]}
              addFromLibrary={addFromLibrary}
            />
          );
        }
        return (
          <Stack
            spacing={3}
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              padding: '2rem',
            }}
          >
            <Button variant="outlined" onClick={createSavedActivity}>
              Add "{query}" to Library
            </Button>
          </Stack>
        );
      }}
    </DataStateView>
  );
};

/**
 * For each SavedActivity that matches the query, render each Activity from the
 * SavedActivity.history.
 */
const LibraryMenuSavedActivityView: FC<{
  savedActivity: SavedActivity;
  addFromLibrary(a: Activity, saved: SavedActivity): void;
}> = ({ savedActivity, addFromLibrary }) => {
  const user = useUser();

  const [pastActivities] = useDataState(() => {
    // Fetch all activities for the SavedActivity we're looking at
    const mapped = savedActivity.history.map(({ activityId, logId }) =>
      db
        .user(user.uid)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .collection(DbPath.UserLogActivities)
        .doc(activityId)
        .withConverter(DbConverter.Activity)
        .get()
        .then(doc => doc.data())
    );
    // Convert Promise<(Activity | undefined)>[] to Activity[]
    return Promise.all(mapped).then(activities => {
      const filtered = activities.filter((a): a is Activity => !!a);
      // Sort activities by date
      filtered.sort((a, b) => {
        const dateA = (a.timestamp as firebase.firestore.Timestamp)?.toDate();
        const dateB = (b.timestamp as firebase.firestore.Timestamp)?.toDate();
        if (!dateA || !dateB) return NaN;
        if (dateA === dateB) return 0;
        return dateA > dateB ? -1 : 1;
      });
      return filtered;
    });
  }, [user.uid, savedActivity.history]);

  return (
    <DataStateView data={pastActivities} empty={() => <p>No history!</p>} loading={() => null}>
      {pastActivities => (
        <Stack spacing={3} sx={{ padding: '0.5rem 0' }}>
          {/** TODO Display `activity.name` as title section and use background-color grouping (?) */}
          {pastActivities.length === 0 ? (
            <Typography variant="body1" color="textSecondary">
              {/** TODO This displays for things that have history actuall... */}
              No history for {savedActivity.name}
            </Typography>
          ) : (
            pastActivities.map(activity => (
              <Stack
                key={activity.id}
                sx={{
                  borderLeft: `3px solid ${Color.ActionPrimaryBlue}`,
                  padding: '0.5rem 1.0rem',
                  backgroundColor: '#f4f9ff',
                }}
              >
                <Rows center between onClick={() => addFromLibrary(activity, savedActivity)}>
                  <Typography variant="subtitle2" color="textSecondary">
                    {activity.name}
                  </Typography>
                  <Stack direction="row" display="flex" alignItems="center" spacing={1}>
                    <DataStateView
                      data={buildDate(activity.timestamp)}
                      loading={() => null}
                      error={() => null}
                    >
                      {date => (
                        <Typography color="textSecondary" variant="subtitle2">
                          {date}
                        </Typography>
                      )}
                    </DataStateView>
                    <Add fontSize="small" sx={{ color: theme => theme.palette.primary.main }} />
                  </Stack>
                </Rows>
                <Rows pad={Pad.Small}>
                  {activity.sets.map(set => (
                    <Typography variant="body2" key={set.uuid}>
                      {set.weight}x{set.repCount}
                    </Typography>
                  ))}
                </Rows>
              </Stack>
            ))
          )}
        </Stack>
      )}
    </DataStateView>
  );
};

const buildDate = (timestamp: null | firebase.firestore.FieldValue): DataState<string> => {
  const _date = (timestamp as firebase.firestore.Timestamp)?.toDate();
  const date = DataState.map(_date ?? DataState.Empty, date => {
    const month = Months[date.getMonth()].slice(0, 3);
    return `${month} ${date.getDate()}`;
  });
  return date;
};

const EditorControlsDateView: FC<{ log: TrainingLog | TrainingTemplate }> = ({ log }) => {
  if (TrainingLog.isTemplate(log)) {
    return (
      <Typography
        variant="overline"
        color="textSecondary"
        sx={{
          lineHeight: 1,
          position: 'absolute',
          bottom: '0.5rem',
          right: '0.5rem',
        }}
      >
        Training Template
      </Typography>
    );
  }

  const _date = TrainingLog.getDate(log);
  const date: DataState<[string, string]> = _date
    ? [format(_date, Format.date), format(_date, Format.time)]
    : DataState.Empty;

  return (
    <DataStateView data={date} loading={() => null} error={() => null}>
      {([date, time]) => (
        <Typography
          variant="overline"
          color="textSecondary"
          sx={{
            lineHeight: 1,
            position: 'absolute',
            bottom: '0.5rem',
            right: '0.5rem',
          }}
        >
          {time} {date}
        </Typography>
      )}
    </DataStateView>
  );
};

import { css } from '@emotion/css';
import {
  Button,
  Chip,
  ClickAwayListener,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import { Add, LocalHotel } from '@material-ui/icons';
import { createPopper, Instance as PopperInstance } from '@popperjs/core/lib/popper-lite';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import FlipMove from 'react-flip-move';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  ActivityView,
  activityViewContainerStyle,
  createTemplateFromLog,
  navBarHeight,
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
  SleepHours,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { baseBg, Color, Columns, Font, Pad, Rows } from '../style';

const smallFont = css`
  font-size: ${Font.Small};
  color: ${Color.FontSecondary};
`;

const controlsFont = css`
  color: white !important;
  text-shadow: 0 0 4px black;
`;

export const TrainingLogEditor: FC = () => {
  const selectSleepHoursRef = useRef<HTMLSelectElement | null>(null);
  const logNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const addActivityInputRef = useRef<HTMLInputElement | null>(null);
  // Do not show the activity input by default
  const [activityName, setActivityName] = useState<string | null>(null);

  /** For ActivityInput autocomplete. */
  const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
  const libraryMenuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popperRef = useRef<PopperInstance | null>(null);

  const [log, setLog] = useState<DataState<TrainingLog | TrainingTemplate>>(DataState.Loading);
  /** Controlled state for `TrainingLog.notes` */
  const [logNotes, setLogNotes] = useState<DataState<string>>(DataState.Empty);
  /** Live data from DbPath.Activity collection snapshots. */
  const [activities, setActivities] = useState<DataState<Activity[]>>(DataState.Loading);

  const menu = useMaterialMenu();
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
          if (log?.notes?.length) setLogNotes(log.notes);
        },
        err => setLog(DataState.error(err.message))
      );
  }, [user.uid, logId, templateId]);

  // Handle creating & destroying Popper refs for the activity library menu
  useEffect(() => {
    if (!inputRef.current || !libraryMenuRef.current) return;
    popperRef.current = createPopper(inputRef.current, libraryMenuRef.current);
    return () => popperRef.current?.destroy();
  });

  const addActivity = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!activityName?.length || !DataState.isReady(log)) return;
      const name = activityName;
      // Hide the input
      setActivityName(null);
      try {
        const activitiesColl = db
          .user(user.uid)
          .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
          .doc(log.id)
          .collection(DbPath.UserLogActivities);
        const { docs } = await activitiesColl.orderBy('position', 'desc').limit(1).get();
        const prevMaxPosition: number = docs[0]?.get('position') ?? 0;
        const entry = Activity.create({
          name,
          position: prevMaxPosition + 1,
          logId: log.id,
          timestamp: log.timestamp,
          sets: [],
          weightUnit: ActivityWeightUnit.Pounds,
          repCountUnit: ActivityRepCountUnit.Repetitions,
        });
        await activitiesColl.add(entry);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activityName, log, user.uid, isTemplate]
  );

  const updateLogNotes = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (logNotes === '') setLogNotes(DataState.Empty);
    try {
      db.user(user.uid)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .update({ notes: logNotes } as Partial<TrainingLog>);
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, logNotes, isTemplate]);

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
      setLibraryMenuOpen(false);
      // Hide the input
      setActivityName(null);
      try {
        const prevMaxPosition = activities[activities.length - 1]?.position ?? 0;
        const sets = activity.sets.map(s => {
          s.status = ActivitySetStatus.Unattempted;
          return s;
        });
        const newActivity = Activity.create({
          name: activity.name,
          sets,
          position: prevMaxPosition + 1,
          logId: log.id,
          timestamp: log.timestamp,
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
        await db
          .user(user.uid)
          .collection(DbPath.UserActivityLibrary)
          .withConverter(DbConverter.SavedActivity)
          .doc(saved.id)
          .set({ history }, { merge: true });
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activities, isTemplate, log, user.uid]
  );

  /** #region log title menu actions */
  const renameLog = useCallback(() => {
    if (!DataState.isReady(log)) return;
    menu.close();
    const title = window.prompt('Update title', log.title);
    if (!title) return;
    try {
      db.user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .set({ title } as Pick<TrainingLog, 'title'>, { merge: true });
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, isTemplate, menu]);

  const openPreviousLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open previous log?')) return;
    menu.close();
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
      toast.error(error.message);
    }
  }, [user.uid, log, history, templateId, menu]);

  const openNextLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open next log?')) return;
    menu.close();
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
      toast.error(error.message);
    }
  }, [user.uid, log, history, templateId, menu]);

  const createTemplate = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    menu.close();
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
      toast.error(error.message);
    }
  }, [log, user.uid, history, isTemplate, menu]);

  const deleteLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm(`Delete "${log.title}" forever?`)) return;
    menu.close();
    try {
      await db
        .user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .delete();
      const logType = isTemplate ? 'Template' : 'Log';
      toast.info(`${logType} deleted.`);
      history.goBack();
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, history, isTemplate, menu]);
  /** #endregion */

  return (
    <DataStateView data={log}>
      {log => (
        <Columns
          className={css`
            height: 100%;
            background-color: ${baseBg};
          `}
        >
          <DataStateView data={activities}>
            {activities => (
              <FlipMove
                enterAnimation="fade"
                leaveAnimation="fade"
                className={css`
                  height: 100%;
                  width: 100%;
                  overflow-y: scroll;
                  ${activityViewContainerStyle}
                  padding: ${Pad.Small} 0;
                  padding-bottom: ${navBarHeight}px;
                `}
              >
                {activities.length ? (
                  activities.map(({ id }, index) => (
                    <ActivityView
                      key={id}
                      editable
                      activities={activities}
                      index={index}
                      log={log}
                    />
                  ))
                ) : (
                  <Typography
                    variant="body1"
                    color="textSecondary"
                    className={css`
                      padding: ${Pad.Large};
                    `}
                  >
                    No activities!
                    {/**
                     * TODO After refactoring and migrating all Activities
                     * Database to a separate Firestore table, fetch them by
                     * recency, limited to 10 or so. Show a list of recent
                     * activities to add to this TrainingLog from. Like the
                     * Activity Library autocomplete menu.
                     */}
                  </Typography>
                )}
              </FlipMove>
            )}
          </DataStateView>
          {/** EDITOR CONTROLS CONTAINER */}
          <Columns
            className={css`
              position: absolute;
              width: 100%;
              bottom: ${navBarHeight}px;
              padding: ${Pad.Medium} ${Pad.Small};
              background-image: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.4), #171717);
            `}
            pad={Pad.Medium}
          >
            {libraryMenuOpen && typeof activityName === 'string' && (
              <ClickAwayListener
                onClickAway={() => {
                  setActivityName(null);
                  setLibraryMenuOpen(false);
                }}
              >
                <div
                  ref={libraryMenuRef}
                  className={css`
                    height: 25vh;
                    overflow-y: scroll;
                    overflow-x: hidden;
                    border-radius: 8px;
                    background-color: #fff;
                    padding: ${Pad.Small} ${Pad.Medium};
                    border: 1px solid ${Color.ActionPrimaryBlue};
                  `}
                >
                  <LibraryAutocomplete
                    query={activityName}
                    setActivityName={(name: string | null) => setActivityName(name)}
                    addFromLibrary={addFromLibrary}
                  />
                </div>
              </ClickAwayListener>
            )}
            {DataState.isReady(logNotes) && (
              <textarea
                name="Training log notes"
                ref={logNotesRef}
                placeholder="Notes"
                rows={3}
                maxLength={500}
                value={logNotes}
                onChange={event => setLogNotes(event.target.value)}
                onBlur={updateLogNotes}
                className={css`
                  width: 100%;
                  color: ${Color.FontSecondary};
                  border: 0;
                  border-left: 4px solid ${Color.ActionSecondaryGray};
                  padding: 0 ${Pad.Small};
                  border-radius: 0;
                  outline: none;
                  resize: vertical;
                  font-size: ${Font.Small};
                  font-style: italic;
                  font-family: inherit;
                  background-color: transparent;

                  &:focus {
                    outline: 1px solid ${Color.ActionPrimaryBlue};
                  }
                `}
              />
            )}
            {activityName === null ? (
              <Rows between>
                <Columns pad={Pad.XSmall} maxWidth>
                  <ClickAwayListener onClickAway={menu.close}>
                    <div>
                      <IconButton
                        aria-label="Open log menu"
                        aria-controls="log-menu"
                        aria-haspopup="true"
                        onClick={menu.open}
                        className={css`
                          padding: 0 !important;
                        `}
                      >
                        <Typography
                          variant="h6"
                          className={css`
                            line-height: 1.2 !important;
                            ${controlsFont}
                          `}
                          textAlign="left"
                        >
                          {log.title}
                        </Typography>
                      </IconButton>
                      <Menu
                        id="log-menu"
                        anchorEl={menu.ref}
                        open={!!menu.ref}
                        onClose={menu.close}
                        MenuListProps={{ dense: true }}
                      >
                        <MenuItem onClick={openPreviousLog}>Go to previous log</MenuItem>
                        <MenuItem onClick={openNextLog}>Go to next log</MenuItem>
                        <MenuItem onClick={renameLog}>Edit name</MenuItem>
                        <MenuItem
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
                        </MenuItem>
                        {!!window.navigator.share && (
                          <MenuItem
                            onClick={() => {
                              menu.close();
                              const url = isTemplate
                                ? Paths.templateView(log.authorId, log.id)
                                : Paths.logView(log.authorId, log.id);
                              window.navigator.share({ url });
                            }}
                          >
                            Share link
                          </MenuItem>
                        )}
                        {!isTemplate && (
                          <MenuItem onClick={createTemplate}>Create Template</MenuItem>
                        )}
                        <MenuItem onClick={deleteLog}>
                          <b>Delete Training {isTemplate ? 'Template' : 'Log'}</b>
                        </MenuItem>
                      </Menu>
                    </div>
                  </ClickAwayListener>
                  <button
                    onClick={() => {
                      // Set to non-null to render the input
                      setActivityName('');
                      // Wait a tick for the input to render so it may be focused
                      Promise.resolve().then(() => addActivityInputRef.current?.focus());
                    }}
                    className={css`
                      border: 2px solid white;
                      background-color: transparent;
                      border-radius: 5px;
                      display: flex;
                      letter-spacing: 0.04em;
                      text-transform: uppercase;
                      align-items: center;
                      padding: 0 10px 0 ${Pad.XSmall};
                      width: min-content;
                      font-size: 0.9rem;
                      ${controlsFont}
                    `}
                  >
                    <Add />
                    <b>Activity</b>
                  </button>
                </Columns>
                {/** RIGHT-SIDE CONTROLS COLUMN */}
                <Columns
                  className={css`
                    justify-content: end;
                  `}
                >
                  {!TrainingLog.isTemplate(log) && (
                    <label
                      className={css`
                        position: relative;
                        ${controlsFont}
                      `}
                    >
                      <select
                        value={log.sleepHours}
                        ref={selectSleepHoursRef}
                        onChange={async event => {
                          try {
                            // Use unary + operator to convert string to number
                            const sleepHours = +event.target
                              .value as typeof SleepHours[keyof typeof SleepHours];
                            // Update sleepHours for the current TrainingLog
                            await db
                              .user(user.uid)
                              .collection(DbPath.UserLogs)
                              .withConverter(DbConverter.TrainingLog)
                              .doc(log.id)
                              .set({ sleepHours }, { merge: true });
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                        className={css`
                          border: none;
                          background: transparent;
                          appearance: none;
                          outline: none;
                          position: absolute;
                          /** Ensure that clicks hit this element. */
                          width: 100%;
                          height: 100%;
                          /** Goes on top so it takes clicks. */
                          z-index: 1;
                          /** Cannot see it but can click it. */
                          opacity: 0;
                        `}
                      >
                        <option aria-label="None" value="-99">
                          -
                        </option>
                        {Object.values(SleepHours).map(opt => (
                          <option key={opt} aria-label={'' + opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {/** SLEEP HOURS AND SLEEP ICON */}
                      <Grid container spacing={1} alignItems="center">
                        <Grid item marginLeft="auto">
                          <LocalHotel />
                        </Grid>
                        {!!log.sleepHours && log.sleepHours !== -99 && (
                          <Grid item>
                            <p className={controlsFont}>{log.sleepHours}h</p>
                          </Grid>
                        )}
                      </Grid>
                    </label>
                  )}
                  <EditorControlsDateView log={log} />
                </Columns>
              </Rows>
            ) : (
              <Rows as="form" onSubmit={addActivity}>
                <TextField
                  fullWidth
                  size="small"
                  inputRef={addActivityInputRef}
                  placeholder="Add Activity..."
                  value={activityName}
                  onBlur={
                    // Close activity autocomplete
                    libraryMenuOpen ? undefined : () => setActivityName(null)
                  }
                  onFocus={() => {
                    // Show activity complete upon initial button click
                    if (activityName === '') {
                      setLibraryMenuOpen(true);
                      libraryMenuRef.current?.setAttribute('data-show', '');
                    }
                  }}
                  onChange={event => {
                    setActivityName(event.target.value);
                    // Show activity autocomplete
                    setLibraryMenuOpen(true);
                    libraryMenuRef.current?.setAttribute('data-show', '');
                  }}
                  className={css`
                    background-color: #fff !important;
                  `}
                />
              </Rows>
            )}
          </Columns>
        </Columns>
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
  setActivityName(name: string | null): void;
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
        .orderBy('name', 'asc')
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
        ),
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
      // Hide the activity input and autocomplete menu
      setActivityName(null);
      toast.success(`Added "${query}" to Activity Library!`);
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, addFromLibrary, query, setActivityName]);

  // TODO - Add X button to activity input to clear it instantly
  return (
    <DataStateView data={queriedActivites}>
      {queriedActivites => {
        if (queriedActivites.length > 1) {
          return (
            <Columns>
              <Typography variant="overline" color="textSecondary">
                Activity Library
              </Typography>
              <Grid container spacing={1}>
                {queriedActivites.map(savedActivity => (
                  <Grid item key={savedActivity.id}>
                    <Chip
                      label={savedActivity.name}
                      onClick={() => setActivityName(savedActivity.name)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Columns>
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
          <Grid
            container
            direction="column"
            justifyContent="center"
            alignItems="center"
            height="100%"
            spacing={3}
          >
            <Grid item>
              <Typography variant="body1" color="textSecondary">
                <b>No results.</b>
              </Typography>
            </Grid>
            <Grid item>
              <Button variant="outlined" onClick={createSavedActivity}>
                Add "{query}" to Library
              </Button>
            </Grid>
          </Grid>
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
        <Columns pad={Pad.Medium}>
          {/** TODO Display `activity.name` as title section and use background-color grouping */}
          {pastActivities.length === 0 ? (
            <Typography variant="body1" color="textSecondary">
              {/** TODO This displays for things that have history actuall... */}
              No history for {savedActivity.name}
            </Typography>
          ) : (
            pastActivities.map(activity => (
              <Columns key={activity.id}>
                <Rows center between onClick={() => addFromLibrary(activity, savedActivity)}>
                  <p>{activity.name}</p>
                  <DataStateView
                    data={buildDate(activity.timestamp)}
                    loading={() => null}
                    error={() => null}
                  >
                    {date => <p className={smallFont}>{date}</p>}
                  </DataStateView>
                </Rows>
                <Rows pad={Pad.Small}>
                  {activity.sets.map(set => (
                    <p className={smallFont} key={set.uuid}>
                      {set.weight}x{set.repCount}
                    </p>
                  ))}
                </Rows>
              </Columns>
            ))
          )}
        </Columns>
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
        variant="body2"
        color="textSecondary"
        className={css`
          width: min-content;
          ${controlsFont}
        `}
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
          variant="body2"
          className={css`
            white-space: nowrap;
            ${controlsFont}
          `}
        >
          {time}
          &nbsp;
          {date}
        </Typography>
      )}
    </DataStateView>
  );
};

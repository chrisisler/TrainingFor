import { css } from '@emotion/css';
import {
  Button,
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { ChatBubbleOutline } from '@material-ui/icons';
import {
  createPopper,
  Instance as PopperInstance,
} from '@popperjs/core/lib/popper-lite';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import FlipMove from 'react-flip-move';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { ActivityView } from '../components/ActivityView';
import {
  activityViewContainerStyle,
  createTemplateFromLog,
  TrainingLogDateView,
} from '../components/TrainingLogView';
import { Months, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import {
  Activity,
  ActivityRepCountUnit,
  ActivityWeightUnit,
  SavedActivity,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

export const TrainingLogEditor: FC = () => {
  const logNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const addActivityInputRef = useRef<HTMLInputElement | null>(null);
  // Do not show the activity input by default
  const [activityName, setActivityName] = useState<string | null>(null);

  /** For ActivityInput autocomplete. */
  const libraryMenuRef = useRef<HTMLDivElement | null>(null);
  const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popperRef = useRef<PopperInstance | null>(null);

  const [log, setLog] = useState<DataState<TrainingLog | TrainingTemplate>>(
    DataState.Loading
  );
  /** Controlled state for `TrainingLog.notes` */
  const [logNotes, setLogNotes] = useState<DataState<string>>(DataState.Empty);
  /** Live data from DbPath.Activity collection snapshots. */
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Loading
  );

  const user = useUser();
  const { logId, templateId } = useParams<{
    logId?: string;
    templateId?: string;
  }>();

  const isTemplate = !!templateId;

  // TrainingLogEditorView useEffect: fetch `activities`
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
              if (!activity.repCountUnit) {
                activity.repCountUnit = ActivityRepCountUnit.Repetitions;
              }
              if (!activity.weightUnit) {
                activity.weightUnit = ActivityWeightUnit.Pounds;
              }
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
      .withConverter(
        templateId ? DbConverter.TrainingTemplate : DbConverter.TrainingLog
      )
      .doc(templateId ?? logId)
      .onSnapshot(
        doc => {
          const log = doc.data();
          setLog(log ?? DataState.Empty);
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
        const { docs } = await activitiesColl
          .orderBy('position', 'desc')
          .limit(1)
          .get();
        const prevMaxPosition: number = docs[0]?.get('position') ?? 0;
        const entry = Activity.create({
          name,
          position: prevMaxPosition + 1,
          logId: log.id,
          timestamp: log.timestamp,
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
    async ({ name }: Activity, saved: SavedActivity) => {
      if (!DataState.isReady(activities) || !DataState.isReady(log)) {
        toast.warn('Data not ready.');
        return;
      }
      setLibraryMenuOpen(false);
      // Hide the input
      setActivityName(null);
      try {
        const prevMaxPosition =
          activities[activities.length - 1]?.position ?? 0;
        const entry = Activity.create({
          name,
          position: prevMaxPosition + 1,
          logId: log.id,
          timestamp: log.timestamp,
        });
        // Add Activity to the current TrainingLog
        const docRef = await db
          .user(user.uid)
          .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
          .doc(log.id)
          .collection(DbPath.UserLogActivities)
          .add(entry);
        // Add Activity to SavedActivity.history
        const history = saved.history.concat({
          activityId: docRef.id,
          logId: log.id,
        });
        await db
          .user(user.uid)
          .collection(DbPath.UserTemplates)
          .doc(saved.id)
          .set({ history }, { merge: true });
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activities, isTemplate, log, user.uid]
  );

  return (
    <DataStateView data={log}>
      {log => (
        <Columns
          pad={Pad.Small}
          className={css`
            height: 100%;
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
                  </Typography>
                )}
              </FlipMove>
            )}
          </DataStateView>
          <Columns
            className={css`
              border-top: 1px solid ${Color.ActionSecondaryGray};
              min-height: fit-content;
              padding: ${Pad.Small} ${Pad.Medium};
            `}
            pad={Pad.Small}
          >
            {libraryMenuOpen && activityName && (
              <ClickAwayListener onClickAway={() => setLibraryMenuOpen(false)}>
                <div
                  ref={libraryMenuRef}
                  className={css`
                    height: 22vh;
                    overflow-y: scroll;
                    border-radius: 8px;
                    border: 1px solid ${Color.ActionPrimaryBlue};
                    padding: ${Pad.Small} ${Pad.Medium};
                  `}
                >
                  <LibraryMenu
                    query={activityName.toLowerCase()}
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
              <>
                <LogTitle log={log} templateId={templateId} />
                <Rows center pad={Pad.XSmall}>
                  <TrainingLogDateView log={log} />
                  <Button
                    variant="contained"
                    fullWidth
                    color="primary"
                    size="small"
                    onClick={() => {
                      // Set to non-null to render the input
                      setActivityName('');
                      // Wait a tick for the input to render so it may be focused
                      Promise.resolve().then(() =>
                        addActivityInputRef.current?.focus()
                      );
                    }}
                    className={css`
                      /** Necessary due to parent height. */
                      height: min-content;
                    `}
                  >
                    + Activity
                  </Button>
                  <IconButton
                    aria-label="Edit training log notes"
                    className={css`
                      color: ${Color.ActionPrimaryGray} !important;
                      transform: scaleX(-1);
                    `}
                    onClick={() => {
                      if (DataState.isReady(logNotes) && logNotes) {
                        logNotesRef.current?.focus();
                        return;
                      }
                      // Unhide the notes input
                      setLogNotes('');
                      Promise.resolve().then(() =>
                        logNotesRef.current?.focus()
                      );
                    }}
                  >
                    <ChatBubbleOutline fontSize="small" />
                  </IconButton>
                </Rows>
              </>
            ) : (
              <Rows maxWidth as="form" onSubmit={addActivity} pad={Pad.Small}>
                <input
                  type="text"
                  ref={addActivityInputRef}
                  placeholder="Add activity..."
                  value={activityName}
                  onBlur={
                    libraryMenuOpen ? undefined : () => setActivityName(null)
                  }
                  onChange={event => {
                    const { value } = event.target;
                    setActivityName(value);
                    if (value === '') {
                      setLibraryMenuOpen(false);
                      libraryMenuRef.current?.removeAttribute('data-show');
                    } else if (value.length < 3) {
                      // Only search after 3
                      return;
                    } else {
                      setLibraryMenuOpen(true);
                      libraryMenuRef.current?.setAttribute('data-show', '');
                    }
                  }}
                  className={css`
                    box-sizing: content-box;
                    width: 100%;
                    border: 1px solid ${Color.ActionPrimaryBlue};
                    box-shadow: none;
                    outline: none;
                    font-weight: 400;
                    color: #000;
                    padding: ${Pad.Small} ${Pad.Medium};
                    border-radius: 8px;

                    &::placeholder {
                      font-weight: 600;
                    }
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

const LibraryMenu: FC<{
  query: string;
  addFromLibrary(a: Activity, saved: SavedActivity): void;
}> = ({ query, addFromLibrary }) => {
  const user = useUser();

  // SavedActivity's matching the query
  const [queriedActivites] = useDataState(
    () =>
      db
        .user(user.uid)
        .collection(DbPath.UserActivityLibrary)
        .withConverter(DbConverter.SavedActivity)
        .get()
        .then(snapshot =>
          // Skip saved activities that do not match the queried name
          snapshot.docs.flatMap(doc => {
            const sa: SavedActivity = doc.data();
            // Firebase does not give an elegant way to filter this way
            // TODO Create normalized field on SavedActivity.name so it can
            // support being searched
            if (sa.name.toLowerCase().startsWith(query)) return [sa];
            return [];
          })
        ),
    [query, user.uid]
  );

  return (
    <DataStateView data={queriedActivites}>
      {savedActivities =>
        savedActivities.length ? (
          <Columns pad={Pad.Small}>
            {savedActivities.map(sa => (
              <LibraryMenuSavedActivityView
                activity={sa}
                key={sa.id}
                addFromLibrary={addFromLibrary}
              />
            ))}
          </Columns>
        ) : (
          <Typography variant="body1" color="textSecondary">
            No results.
          </Typography>
        )
      }
    </DataStateView>
  );
};

/**
 * For each SavedActivity that matches the query, render each Activity from the
 * SavedActivity.history.
 */
const LibraryMenuSavedActivityView: FC<{
  activity: SavedActivity;
  addFromLibrary(a: Activity, saved: SavedActivity): void;
}> = ({ activity, addFromLibrary }) => {
  const user = useUser();

  const [pastActivities] = useDataState(() => {
    // Fetch all activities for the SavedActivity we're looking at
    const mapped = activity.history.map(({ activityId, logId }) =>
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
    return Promise.all(mapped).then(m => m.filter((a): a is Activity => !!a));
  }, [user.uid, activity.history]);

  return (
    <DataStateView data={pastActivities} empty={() => <p>No history!</p>}>
      {pastActivities => (
        <Columns pad={Pad.Medium}>
          {/** TODO Display `activity.name` as title section and use background-color grouping */}
          {pastActivities.length === 0 ? (
            <Typography variant="body1" color="textSecondary">
              {/** TODO This displays for things that have history actuall... */}
              No history for {activity.name}
            </Typography>
          ) : (
            pastActivities.map(a => (
              <Rows
                key={a.id}
                center
                between
                onClick={() => addFromLibrary(a, activity)}
              >
                <p>{a.name}</p>
                <DataStateView
                  data={buildDate(a.timestamp)}
                  loading={() => null}
                  error={() => null}
                >
                  {date => <p>{date}</p>}
                </DataStateView>
              </Rows>
            ))
          )}
        </Columns>
      )}
    </DataStateView>
  );
};

const buildDate = (
  timestamp: null | firebase.firestore.FieldValue
): DataState<string> => {
  const _date = (timestamp as firebase.firestore.Timestamp)?.toDate();
  const date = DataState.map(_date ?? DataState.Empty, date => {
    const month = Months[date.getMonth()].slice(0, 3);
    return `${month} ${date.getDate()}`;
  });
  return date;
};

const LogTitle: FC<{
  log: TrainingLog | TrainingTemplate;
  /** Undefined if `log` is a `TrainingTemplate`. */
  templateId?: string;
}> = ({ log, templateId }) => {
  const menu = useMaterialMenu();
  const user = useUser();
  const history = useHistory();

  const isTemplate = TrainingLog.isTemplate(log);

  const renameLog = useCallback(() => {
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
      const createPath = templateId ? Paths.template : Paths.logEditor;
      history.push(createPath(doc.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, history, templateId, menu]);

  const openNextLog = useCallback(async () => {
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
      const createPath = templateId ? Paths.template : Paths.logEditor;
      history.push(createPath(doc.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, history, templateId, menu]);

  const createTemplate = useCallback(async () => {
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
      }
      history.push(Paths.template(newTemplateId));
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, user.uid, history, isTemplate, menu]);

  const deleteLog = useCallback(async () => {
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
      history.push(Paths.account);
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, history, isTemplate, menu]);
  return (
    <ClickAwayListener onClickAway={menu.close}>
      <div
        className={css`
          text-align: center;
        `}
      >
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
            variant="body1"
            color="textPrimary"
            className={css`
              line-height: 1.2 !important;
            `}
          >
            <b>{log.title}</b>
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
  );
};

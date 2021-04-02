import { css } from '@emotion/css';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import {
  ArrowBackIosRounded,
  ArrowForwardIosRounded,
  ChatBubbleOutline,
} from '@material-ui/icons';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  TrainingLogDateView,
  TrainingLogEditorView,
} from '../components/TrainingLogView';
import { Paths } from '../constants';
import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import {
  Activity,
  ActivityStatus,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

export const TrainingLogEditor: FC = () => {
  const logNotesRef = useRef<HTMLTextAreaElement | null>(null);

  const [activityName, setActivityName] = useState<string>('');
  const [log, setLog] = useState<DataState<TrainingLog | TrainingTemplate>>(
    DataState.Loading
  );
  const [logNotes, setLogNotes] = useState<DataState<string>>(DataState.Empty);

  const menu = useMaterialMenu();
  const history = useHistory();
  const user = useUser();
  const { logId, templateId } = useParams<{
    logId?: string;
    templateId?: string;
  }>();

  const isTemplate = !!templateId;

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

  const renameLog = useCallback(() => {
    menu.close();
    if (!DataState.isReady(log)) return;
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

  const addActivity = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!activityName.length || !DataState.isReady(log)) return;
      setActivityName('');
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
        activitiesColl.add(
          Activity.create({
            name: activityName,
            position: prevMaxPosition + 1,
          })
        );
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activityName, log, user.uid, isTemplate]
  );

  const openPreviousLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open previous log?')) return;
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
  }, [user.uid, log, history, templateId]);

  const openNextLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open next log?')) return;
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
  }, [user.uid, log, history, templateId]);

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

  const createTemplate = useCallback(async () => {
    menu.close();
    if (isTemplate) return;
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Create a Template from this log?')) return;
    try {
      const newTemplate: TrainingTemplate = {
        ...log,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        logIds: [],
      };
      const templateRefP = db
        .user(user.uid)
        .collection(DbPath.UserTemplates)
        .add(newTemplate);
      const logDoc = db.user(user.uid).collection(DbPath.UserLogs).doc(log.id);
      const activitiesP = logDoc
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .get()
        .then(snapshot =>
          snapshot.docs.map(doc => {
            const activity = doc.data();
            activity.sets.forEach(set => {
              set.status = ActivityStatus.Unattempted;
            });
            return activity;
          })
        );
      const [templateRef, logActivities] = await Promise.all([
        templateRefP,
        activitiesP,
      ]);
      const templateActivities = templateRef.collection(
        DbPath.UserLogActivities
      );
      const batch = db.batch();
      logActivities.forEach(a => batch.set(templateActivities.doc(a.id), a));
      await batch.commit();
      if (window.confirm('Delete original log?')) {
        await logDoc.delete();
        toast.info('Deleted original log.');
      }
      history.push(Paths.template(templateRef.id));
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
      history.push(Paths.account);
      toast.info('Deleted successfully!');
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, history, isTemplate, menu]);

  return (
    <DataStateView data={log}>
      {log => (
        <Columns
          pad={Pad.Small}
          className={css`
            height: 100%;
          `}
        >
          <Columns
            padding={`${Pad.Small} ${Pad.Large} ${Pad.Medium}`}
            className={css`
              border-bottom: 1px solid ${Color.ActionSecondaryGray};
              min-height: fit-content;
            `}
            pad={Pad.Medium}
          >
            <Rows center between>
              <Columns>
                <TrainingLogDateView log={log} />
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
                        color="textPrimary"
                        className={css`
                          line-height: 1.2 !important;
                          text-align: left;
                        `}
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
                      <MenuItem onClick={renameLog}>Edit name</MenuItem>
                      {window.navigator.share && (
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
                        <MenuItem onClick={createTemplate}>
                          Create Template
                        </MenuItem>
                      )}
                      <MenuItem onClick={deleteLog}>
                        <b>Delete Training {isTemplate ? 'Template' : 'Log'}</b>
                      </MenuItem>
                    </Menu>
                  </div>
                </ClickAwayListener>
              </Columns>
              <Rows>
                <IconButton
                  aria-label="Edit training log notes"
                  className={css`
                    color: ${Color.ActionSecondaryGray} !important;
                    transform: scaleX(-1);
                  `}
                  onClick={() => {
                    if (DataState.isReady(logNotes) && logNotes) return;
                    // Unhide the notes input
                    setLogNotes('');
                    Promise.resolve().then(() => logNotesRef.current?.focus());
                  }}
                >
                  <ChatBubbleOutline fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label="Open previous log"
                  size="small"
                  className={css`
                    color: ${Color.ActionSecondaryGray} !important;
                  `}
                  onClick={openPreviousLog}
                >
                  <ArrowBackIosRounded fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label="Open next log"
                  size="small"
                  className={css`
                    color: ${Color.ActionSecondaryGray} !important;
                  `}
                  onClick={openNextLog}
                >
                  <ArrowForwardIosRounded fontSize="small" />
                </IconButton>
              </Rows>
            </Rows>
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
                `}
              />
            )}
            <Rows maxWidth as="form" onSubmit={addActivity} pad={Pad.Medium}>
              <input
                type="text"
                placeholder="Add activity..."
                value={activityName}
                onChange={event => setActivityName(event.target.value)}
                className={css`
                  box-sizing: content-box;
                  width: 100%;
                  border: none;
                  box-shadow: none;
                  outline: none;
                  font-weight: 400;
                  color: #000;
                  padding: ${Pad.XSmall} 0;
                  line-height: 1.6;

                  &::placeholder {
                    font-weight: 600;
                  }
                `}
              />
              {activityName.length > 0 && (
                <button
                  className={css`
                    padding: ${Pad.Small} ${Pad.Large};
                    border-radius: 5px;
                    border: 1px solid ${Color.ActionSecondaryGray};
                    background-color: transparent;
                    text-transform: uppercase;
                    font-size: ${Font.Small};
                    font-weight: 600;
                    color: ${Color.ActionPrimaryBlue};
                  `}
                  onClick={addActivity}
                >
                  Add
                </button>
              )}
            </Rows>
          </Columns>
          <TrainingLogEditorView log={log} />
        </Columns>
      )}
    </DataStateView>
  );
};

import { css } from '@emotion/css';
import { IconButton, Typography } from '@material-ui/core';
import {
  ArrowBackIosRounded,
  ArrowForwardIosRounded,
} from '@material-ui/icons';
import format from 'date-fns/format';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { TrainingLogMenuButton } from '../components/TrainingLogMenuButton';
import { TrainingLogEditorView } from '../components/TrainingLogView';
import { Format, Paths } from '../constants';
import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { Activity, TrainingLog, TrainingTemplate } from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

export const TrainingLogEditor: FC = () => {
  const [activityName, setActivityName] = useState<string>('');
  const [log, setLog] = useState<DataState<TrainingLog | TrainingTemplate>>(
    DataState.Loading
  );

  const history = useHistory();
  const user = useUser();
  const { logId, templateId } = useParams<{
    logId?: string;
    templateId?: string;
  }>();

  const isTemplate = !!templateId;

  const logDate = useMemo(
    () =>
      DataState.map(log, l => {
        if (TrainingLog.isTemplate(l)) return DataState.Empty;
        const date = TrainingLog.getDate(l);
        if (!date) return DataState.Empty;
        return format(date, Format.time);
      }),
    [log]
  );

  // Subscribe to updates to the TrainingLog/Template ID from the URL
  useEffect(() => {
    if (!logId && !templateId) {
      toast.error('No logId or templateId given in URL.');
      return;
    }
    return db
      .collection(DbPath.Users)
      .doc(user.uid)
      .collection(templateId ? DbPath.UserTemplates : DbPath.UserLogs)
      .withConverter(
        templateId ? DbConverter.TrainingTemplate : DbConverter.TrainingLog
      )
      .doc(templateId ?? logId)
      .onSnapshot(
        doc => setLog(doc.data() ?? DataState.error('No doc found')),
        err => setLog(DataState.error(err.message))
      );
  }, [user.uid, logId, templateId]);

  // TODO Use border-less input for title
  const renameLog = useCallback(() => {
    if (!DataState.isReady(log)) return;
    const title = window.prompt('Update training log title', log.title);
    if (!title) return;
    try {
      db.collection(DbPath.Users)
        .doc(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .set({ title } as Pick<TrainingLog, 'title'>, { merge: true });
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, isTemplate]);

  const addActivity = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!activityName.length || !DataState.isReady(log)) return;
      setActivityName('');
      try {
        const activitiesColl = db
          .collection(DbPath.Users)
          .doc(user.uid)
          .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
          .doc(log.id)
          .collection(DbPath.UserLogActivities);
        const { docs } = await activitiesColl
          .orderBy('position', 'desc')
          .limit(1)
          .get();
        const prevMaxPosition = docs[0]?.get('position') ?? 0;
        const newActivity: Omit<Activity, 'id'> = {
          name: activityName,
          notes: null,
          sets: [],
          position: prevMaxPosition + 1,
          attachmentUrl: null,
        };
        activitiesColl.add(newActivity);
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
        .collection(DbPath.Users)
        .doc(user.uid)
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
        .collection(DbPath.Users)
        .doc(user.uid)
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
              border-bottom: 1px solid lightgray;
              min-height: fit-content;
            `}
          >
            <Rows center maxWidth between>
              <Columns>
                <Typography variant="body2" color="textSecondary">
                  {templateId ? (
                    <i>
                      <b>Training Template</b>
                    </i>
                  ) : (
                    <DataStateView
                      data={logDate}
                      loading={() => <>Loading...</>}
                      error={() => null}
                    >
                      {logDate => <>{logDate}</>}
                    </DataStateView>
                  )}
                </Typography>
                <Typography
                  variant="h6"
                  color="textPrimary"
                  onClick={renameLog}
                  className={css`
                    line-height: 1.2;
                  `}
                >
                  {log.title}
                </Typography>
              </Columns>
              <Rows>
                <TrainingLogMenuButton log={log} />
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
            <Rows
              maxWidth
              as="form"
              onSubmit={addActivity}
              padding={`${Pad.Medium} 0 0 0`}
              pad={Pad.Medium}
            >
              <input
                type="text"
                placeholder="Add an activity..."
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
                    padding: ${Pad.Small} ${Pad.Medium};
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

import { css } from '@emotion/css';
import { IconButton, Typography } from '@material-ui/core';
import {
  ArrowBackIosRounded,
  ArrowForwardIosRounded,
} from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { TrainingLogMenuButton } from '../components/TrainingLogMenuButton';
import { TrainingLogEditorView } from '../components/TrainingLogView';
import { Format, Paths } from '../constants';
import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { Activity, TrainingLog } from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

export const TrainingLogEditor: FC = () => {
  const [activityName, setActivityName] = useState<string>('');

  const history = useHistory();
  const user = useUser();
  const { logId } = useParams<{ logId?: string }>();

  const [logDoc, setLogDoc] = useState<
    DataState<firebase.firestore.DocumentSnapshot<TrainingLog>>
  >(DataState.Loading);

  const log = useMemo(
    () =>
      // TODO Eliminate `logDoc`
      DataState.map(
        logDoc,
        doc =>
          doc.data() ?? DataState.error('TrainingLog document does not exist.')
      ),
    [logDoc]
  );

  const logDate = useMemo(
    () =>
      DataState.map(log, l => {
        const date = TrainingLog.getDate(l);
        if (!date) return DataState.Empty;
        return format(date, Format.time);
      }),
    [log]
  );

  // Subscribe to updates to the TrainingLog ID from the URL
  useEffect(() => {
    if (!logId) return;
    return db
      .collection(DbPath.Users)
      .doc(user.uid)
      .collection(DbPath.UserLogs)
      .withConverter(DbConverter.TrainingLog)
      .doc(logId)
      .onSnapshot(
        document => setLogDoc(document),
        err => setLogDoc(DataState.error(err.message))
      );
  }, [user.uid, logId]);

  // TODO Use border-less input for log title
  const renameLog = useCallback(() => {
    if (!DataState.isReady(log)) return;
    const newTitle = window.prompt('Update training log title', log.title);
    if (!newTitle) return;
    try {
      db.collection(DbPath.Users)
        .doc(log.authorId)
        .collection(DbPath.UserLogs)
        .doc(log.id)
        .set({ title: newTitle } as Partial<TrainingLog>, { merge: true });
    } catch (error) {
      toast.error(error.message);
    }
  }, [log]);

  const addActivity = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!activityName.length || !DataState.isReady(logDoc)) return;
      setActivityName('');
      try {
        const activitiesColl = logDoc.ref.collection(DbPath.UserLogActivities);
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
    [activityName, logDoc]
  );

  const openPreviousLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open previous log?')) return;
    try {
      const { docs } = await db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserLogs)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .startAfter(log.timestamp)
        .get();
      const doc = docs[0];
      if (!doc) {
        toast.warn('No log found');
        return;
      }
      history.push(Paths.logEditor(doc.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, history]);

  const openNextLog = useCallback(async () => {
    if (!DataState.isReady(log)) return;
    if (!window.confirm('Open next log?')) return;
    try {
      const { docs } = await db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserLogs)
        .orderBy('timestamp', 'asc')
        .limit(1)
        .startAfter(log.timestamp)
        .get();
      const doc = docs[0];
      if (!doc) {
        toast.warn('No log found');
        return;
      }
      history.push(Paths.logEditor(doc.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, history]);

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
            padding={`${Pad.Medium} ${Pad.Large}`}
            className={css`
              border-bottom: 1px solid lightgray;
              min-height: fit-content;
            `}
          >
            <Rows center maxWidth between>
              <Columns>
                <Typography variant="body2" color="textSecondary">
                  <DataStateView
                    data={logDate}
                    loading={() => <>Loading...</>}
                    error={() => null}
                  >
                    {logDate => <>{logDate}</>}
                  </DataStateView>
                </Typography>
                <Typography
                  color="textPrimary"
                  onClick={renameLog}
                  className={css`
                    /** Slightly smaller than variant=h6 */
                    font-size: 1.2rem;
                    line-height: 1.2;
                  `}
                >
                  <b>{log.title}</b>
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
                    border: 1px solid lightgray;
                    background-color: transparent;
                    text-transform: uppercase;
                    font-size: ${Font.Small};
                    font-weight: 600;
                    outline: none;
                    color: ${Color.FontPrimary};
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

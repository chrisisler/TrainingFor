import { css } from '@emotion/css';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { MoreVert } from '@material-ui/icons';
import format from 'date-fns/format';
import firebase from 'firebase/app';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { TrainingLogEditorView } from '../components/TrainingLogView';
import { Format, Paths } from '../constants';
import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import { Activity, TrainingLog } from '../interfaces';
import { Columns, Pad, Rows } from '../style';

export const TrainingLogEditor: FC = () => {
  const [activityName, setActivityName] = useState<string>('');

  const history = useHistory();
  const user = useUser();
  const { logId } = useParams<{ logId?: string }>();
  const menu = useMaterialMenu();

  const [logDoc, setLogDoc] = useState<
    DataState<firebase.firestore.DocumentSnapshot<TrainingLog>>
  >(DataState.Loading);

  const log = DataState.map(logDoc, doc => {
    const log = doc.data();
    if (!log) return DataState.error('TrainingLog document does not exist.');
    return log;
  });

  const logDate = DataState.map(log, l => TrainingLog.getDate(l));

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
        const { size: activitiesCount } = await activitiesColl.get();
        const newActivity: Omit<Activity, 'id'> = {
          name: activityName,
          notes: null,
          sets: [],
          position: activitiesCount + 1,
          attachmentUrl: null,
        };
        activitiesColl.add(newActivity);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activityName, logDoc]
  );

  const deleteLog = useCallback(() => {
    if (!DataState.isReady(logDoc)) return;
    if (!window.confirm('Delete this training log forever?')) return;
    try {
      logDoc.ref.delete();
    } catch (error) {
      toast.error(error.message);
    } finally {
      history.push(Paths.account);
    }
  }, [logDoc, history]);

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
              <Typography variant="h6" color="textPrimary">
                {log.title}
              </Typography>
              <ClickAwayListener onClickAway={menu.close}>
                <div>
                  <IconButton
                    aria-label="Open log menu"
                    aria-controls="log-menu"
                    aria-haspopup="true"
                    onClick={menu.open}
                    size="small"
                  >
                    <MoreVert
                      className={css`
                        color: lightgray;
                      `}
                    />
                  </IconButton>
                  <Menu
                    id="log-menu"
                    anchorEl={menu.ref}
                    open={!!menu.ref}
                    onClose={menu.close}
                    MenuListProps={{ dense: true }}
                  >
                    <MenuItem onClick={renameLog}>Edit title</MenuItem>
                    <MenuItem onClick={deleteLog}>
                      <b>Delete training log</b>
                    </MenuItem>
                  </Menu>
                </div>
              </ClickAwayListener>
            </Rows>
            {DataState.isReady(logDate) &&
              (!logDate ? null : (
                <Rows center pad={Pad.XSmall}>
                  <Typography variant="body2" color="textPrimary">
                    {format(logDate, Format.time)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {format(logDate, Format.date)}
                  </Typography>
                </Rows>
              ))}
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
                  font-size: 1em;
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
                    font-size: 0.8em;
                    font-weight: 600;
                    outline: none;
                    color: rgba(0, 0, 0, 0.87);
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

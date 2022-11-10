import { css } from '@emotion/css';
import {
  Button,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { DataState, DataStateView } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import { Activity, SavedActivity } from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

/**
 * The Activity Library is a curation of saved activities and that activity's
 * history.
 */
export const Library: FC = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [newActivityName, setNewActivityName] = useState<string | null>(null);

  const [activities, setActivities] = useState<DataState<SavedActivity[]>>(DataState.Loading);

  const user = useUser();

  const addSavedActivity = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!newActivityName) return;
      try {
        const newActivity = SavedActivity.create({
          name: newActivityName,
        });
        await db.user(user.uid).collection(DbPath.UserActivityLibrary).add(newActivity);
        // Hide the input
        setNewActivityName(null);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [user.uid, newActivityName]
  );

  // Load library activities and maintain up-to-date value
  useEffect(() => {
    return db
      .user(user.uid)
      .collection(DbPath.UserActivityLibrary)
      .withConverter(DbConverter.SavedActivity)
      .orderBy('name', 'asc')
      .onSnapshot(
        snapshot => setActivities(snapshot.docs.map(doc => doc.data())),
        err => setActivities(DataState.error(err.message))
      );
  }, [user.uid]);

  return (
    <Columns
      pad={Pad.Large}
      className={css`
        height: 100%;
        width: 100%;
        padding: ${Pad.Medium} ${Pad.Large};
      `}
    >
      <Columns pad={Pad.Small}>
        <Typography variant="h6">Activity Library</Typography>
        {newActivityName === null ? (
          <Button
            variant="outlined"
            onClick={() => {
              // Set the input value to non-null so it gets rendered
              setNewActivityName('');
              Promise.resolve().then(() => inputRef.current?.focus());
            }}
            size="small"
          >
            + Add
          </Button>
        ) : (
          <form
            onSubmit={addSavedActivity}
            className={css`
              width: 100%;
            `}
          >
            <input
              type="text"
              ref={inputRef}
              onChange={event => setNewActivityName(event.target.value)}
              onBlur={() => {
                // Hide the input
                if (newActivityName === '') setNewActivityName(null);
              }}
              value={newActivityName ?? ''}
              placeholder="Activity name..."
              className={css`
                box-sizing: border-box;
                background-color: transparent;
                padding: ${Pad.Small} ${Pad.Medium};
                border-radius: 8px;
                border: 1px solid ${Color.ActionSecondaryGray};
                outline: none;
                box-shadow: none;
                color: #000;
                width: 100%;

                &::placeholder {
                  font-weight: 600;
                }
              `}
            />
          </form>
        )}
      </Columns>
      <DataStateView data={activities}>
        {activities => (
          <Columns
            pad={Pad.Medium}
            className={css`
              height: 100%;
              overflow-y: scroll;
            `}
          >
            {activities.length === 0 ? (
              <Typography variant="body1" color="textSecondary">
                No saved activites.
              </Typography>
            ) : (
              activities.map(a => <SavedActivityView key={a.id} activity={a} />)
            )}
          </Columns>
        )}
      </DataStateView>
    </Columns>
  );
};

const SavedActivityView: FC<{ activity: SavedActivity }> = ({ activity }) => {
  const [open, setOpen] = useState(false);

  const user = useUser();
  const menu = useMaterialMenu();

  const deleteSavedActivity = useCallback(() => {
    if (!window.confirm(`Delete ${activity.name} history forever?`)) return;
    try {
      db.user(user.uid).collection(DbPath.UserActivityLibrary).doc(activity.id).delete();
    } catch (error) {
      toast.error(error.message);
    }
  }, [activity.id, activity.name, user.uid]);

  return (
    <Rows
      between
      center
      className={css`
        border-radius: 8px;
        border: 1px solid ${Color.ActionSecondaryGray};
        padding: ${Pad.Medium} ${Pad.Large};
      `}
    >
      <ClickAwayListener onClickAway={menu.onClose}>
        <div>
          <button
            aria-label="Open saved activity menu"
            aria-controls="saved-activity-menu"
            aria-haspopup="true"
            onClick={menu.onOpen}
            className={css`
              color: ${Color.FontPrimary};
              font-size: ${Font.Medium};
              font-weight: 500;
              padding: 0;
              border: none;
              background-color: transparent;
              font-family: system-ui;
              box-shadow: none;
              text-align: left;
              outline: none;
            `}
          >
            {activity.name}
          </button>
          <Menu
            id="saved-activity-menu"
            anchorEl={menu.ref}
            open={!!menu.ref}
            onClose={menu.onClose}
            MenuListProps={{ dense: true }}
          >
            <MenuItem
              onClick={() => {
                menu.onClose();
                const name = window.prompt('Update name', activity.name);
                if (!name) return;
                try {
                  db.user(user.uid)
                    .collection(DbPath.UserActivityLibrary)
                    .doc(activity.id)
                    .update({ name } as Pick<SavedActivity, 'name'>);
                } catch (error) {
                  toast.error(error.message);
                }
              }}
            >
              Edit name
            </MenuItem>
            {process.env.NODE_ENV === 'development' && (
              <MenuItem
                onClick={() => {
                  menu.onClose();
                  setOpen(true);
                }}
              >
                Add history (!)
              </MenuItem>
            )}
            <MenuItem onClick={deleteSavedActivity}>
              <b>Delete saved activity</b>
            </MenuItem>
          </Menu>
        </div>
      </ClickAwayListener>
      {open && (
        <Dialog
          disableEscapeKeyDown
          fullScreen
          maxWidth="sm"
          aria-labelledby="edit-activity-history"
          open={open}
        >
          <DialogTitle id="edit-activity-history">Add {activity.name} history</DialogTitle>
          <DialogContent dividers>
            <AddHistoryForm activity={activity} closeModal={() => setOpen(false)} />
          </DialogContent>
          <DialogActions>
            <Button autoFocus onClick={() => setOpen(false)} color="primary">
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {activity.history.length > 0 && (
        <Columns
          className={css`
            color: ${Color.FontPrimary};
            text-align: right;
            font-size: ${Font.Small};

            & > p span {
              color: ${Color.FontSecondary};
            }
          `}
        >
          <p>
            <span>Logs: </span>
            {activity.history.length}
          </p>
        </Columns>
      )}
    </Rows>
  );
};

const AddHistoryForm: FC<{
  activity: SavedActivity;
  closeModal(): void;
}> = ({ activity, closeModal }) => {
  const [historyQuery, setHistoryQuery] = useState('');
  /** The ID's of selected `Activity`s (with the log they belong to). */
  const [selected, setSelected] = useState<SavedActivity['history']>([]);
  const [activities, setActivities] = useState<DataState<Activity[]>>(DataState.Loading);

  const filteredActivities: DataState<Activity[]> = useMemo(() => {
    if (!DataState.isReady(activities)) return activities;
    if (!historyQuery) return activities;
    if (historyQuery.length === 1) return activities;
    return activities.filter(a => a.name.toLowerCase().includes(historyQuery));
  }, [activities, historyQuery]);

  const user = useUser();

  /**
   * Write the selected log activities in the modal to the
   * SavedActivity.history in Firebase.
   */
  const addSelectedHistory = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      // Do not add duplicates
      const nonduped = selected.filter(
        s => !activity.history.some(h => h.activityId === s.activityId)
      );
      const diff = selected.length - nonduped.length;
      if (diff) toast.info(`Adding ${selected.length} (${diff} duplicates).`);
      const history = activity.history.concat(nonduped);
      try {
        await db
          .user(user.uid)
          .collection(DbPath.UserActivityLibrary)
          .doc(activity.id)
          .set({ history }, { merge: true });
        // Close modal after success
        closeModal();
      } catch (error) {
        toast.error(error.message);
      }
    },
    [activity.history, activity.id, user.uid, selected, closeModal]
  );

  useEffect(() => {
    db.user(user.uid)
      .collection(DbPath.UserLogs)
      .withConverter(DbConverter.TrainingLog)
      .get()
      .then(logsSnapshot => {
        // Fetch the Activity[] list collection from every TrainingLog
        const promises = logsSnapshot.docs.map(async doc => {
          // Grab the log timestamp to attach to each Activity
          const timestamp = doc.get('timestamp');
          // Get a snapshot of the activities of the current log
          const snapshot = await doc.ref
            .collection(DbPath.UserLogActivities)
            .withConverter(DbConverter.Activity)
            .get();
          // Attach the logId and log timestamp to the activity
          return snapshot.docs.map(doc => {
            const data = doc.data();
            data.logId = doc.id;
            data.timestamp = timestamp;
            return data;
          });
        });
        return Promise.all(promises);
      })
      .then(arrays => {
        // Activities are grouped by array, flatten them into one array
        const activities = arrays.flatMap(a => a);
        setActivities(activities);
      })
      .catch(error => {
        toast.error(error.message);
      });
  }, [user.uid]);

  return (
    <>
      <input
        type="text"
        placeholder="Filter by name..."
        onChange={event => setHistoryQuery(event.target.value)}
        value={historyQuery}
        className={css`
            border: 1px solid ${Color.ActionSecondaryGray}
            border-radius: 8px;
            padding: ${Pad.Small} ${Pad.Medium};
            width: 100%;
            box-sizing: border-box;
          `}
      />
      <DataStateView data={filteredActivities}>
        {activities => (
          <form
            onSubmit={addSelectedHistory}
            className={css`
              width: 100%;
            `}
          >
            <fieldset
              className={css`
                border: none;
                height: 100%;
                overflow-y: scroll;
              `}
            >
              {activities.length === 0 ? (
                <h3>Nothing here</h3>
              ) : (
                activities.map(activity => (
                  <HistoryActivityRow
                    key={activity.id}
                    activity={activity}
                    onChange={event => {
                      const { checked } = event.target;
                      if (checked) {
                        const entry = {
                          activityId: activity.id,
                          logId: activity.logId,
                        };
                        setSelected(selected.concat(entry));
                        return;
                      }
                      setSelected(selected.filter(s => s.activityId !== activity.id));
                    }}
                  />
                ))
              )}
              <div
                className={css`
                  margin-top: ${Pad.Medium};
                `}
              >
                <Button fullWidth variant="contained" type="submit">
                  Add
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </DataStateView>
    </>
  );
};

const HistoryActivityRow: FC<{
  activity: Activity;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}> = ({ activity, onChange }) => {
  return (
    <Rows center pad={Pad.Medium} padding={`${Pad.Small} ${Pad.XSmall}`}>
      <input
        autoFocus
        type="checkbox"
        name={activity.name}
        id={activity.id + 1}
        onChange={onChange}
      />
      <label htmlFor={activity.id + 1}>{activity.name}</label>
      <p
        className={css`
          font-size: ${Font.Small};
          color: ${Color.ActionSecondaryGray};
        `}
      >
        {activity.id}
      </p>
    </Rows>
  );
};

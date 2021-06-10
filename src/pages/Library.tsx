import { css } from '@emotion/css';
import {
  Button,
  ClickAwayListener,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { DataState, DataStateView, useDataState } from '../DataState';
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

  const [activities, setActivities] = useState<DataState<SavedActivity[]>>(
    DataState.Loading
  );

  const user = useUser();

  const addActivity = useCallback(
    <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      if (!newActivityName) return;
      try {
        const newActivity = SavedActivity.create({
          name: newActivityName,
        });
        db.user(user.uid)
          .collection(DbPath.UserActivityLibrary)
          .add(newActivity);
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
    db.user(user.uid)
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
            onSubmit={addActivity}
            className={css`
              width: 100%;
            `}
          >
            <input
              type="text"
              ref={inputRef}
              onChange={event => setNewActivityName(event.target.value)}
              onBlur={event => {
                // Hide the input
                if (newActivityName === '') setNewActivityName(null);
              }}
              value={newActivityName ?? ''}
              placeholder="Activity..."
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
  return (
    <Rows
      between
      className={css`
        border-radius: 8px;
        border: 1px solid ${Color.ActionSecondaryGray};
        padding: ${Pad.Medium} ${Pad.Large};
      `}
    >
      <button
        className={css`
          color: ${Color.FontPrimary};
          font-size: ${Font.Medium};
          font-weight: 500;
          padding: 0;
          border: none;
          background-color: transparent;
          font-family: system-ui;
          text-align: left;
          outline: none;
        `}
      >
        {activity.name}
      </button>
      <Columns>
        <p
          className={css`
            font-size: 2.2em;
            line-height: 1em;
            color: ${Color.ActionPrimaryBlue};
          `}
        >
          {activity.history.length}
        </p>
        <p
          className={css`
            font-size: ${Font.Small};
            color: ${Color.FontSecondary};
          `}
        >
          entries
        </p>
      </Columns>
    </Rows>
  );
};

// const createLibraryFromLogs = useCallback(async () => {
//   try {
//     const logsSnapshot = await db
//       .user(user.uid)
//       .collection(DbPath.UserLogs)
//       .withConverter(DbConverter.TrainingLog)
//       .get();
//     // Fetch the Activity[] list collection from every TrainingLog
//     const promises = logsSnapshot.docs.map(doc =>
//       doc.ref
//         .collection(DbPath.UserLogActivities)
//         .withConverter(DbConverter.Activity)
//         .get()
//         .then(snapshot => snapshot.docs.map(doc => doc.data()))
//     );
//     const activities = (await Promise.all(promises)).flatMap(a => a);
//   } catch (error) {
//     toast.error(error.message);
//   }
// }, [user.uid]);

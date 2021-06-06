import { css } from '@emotion/css';
import { Button, Typography } from '@material-ui/core';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { Activity } from '../interfaces';
import { Color, Columns, Font, Pad, Rows } from '../style';

export const Library: FC = () => {
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Loading
  );

  const user = useUser();

  const hasLogs = useDataState<boolean>(async () => {
    const { size } = await db.user(user.uid).collection(DbPath.UserLogs).get();
    return !!size;
  }, [activities]);

  /**
   * Allows the user to generate their Activity Library from their existing logs
   * if their library has no activities and they have training logs (assumes that
   * their logs have Activities)
   */
  // TODO New Activities added to a log get added to the Library if not present
  // TODO DO not add Activitys who's `.id` has already been added
  const createLibraryFromLogs = useCallback(async () => {
    try {
      const logsSnapshot = await db
        .user(user.uid)
        .collection(DbPath.UserLogs)
        .withConverter(DbConverter.TrainingLog)
        .get();
      // Fetch the Activity[] list collection from every TrainingLog
      const promises = logsSnapshot.docs.map(doc =>
        doc.ref
          .collection(DbPath.UserLogActivities)
          .withConverter(DbConverter.Activity)
          .get()
          .then(snapshot => snapshot.docs.map(doc => doc.data()))
      );
      const activities = (await Promise.all(promises)).flatMap(a => a);
      const library = db.user(user.uid).collection(DbPath.UserActivityLibrary);
      let batch = db.batch();
      // Bulk-write the activites to the user Library collection
      activities.forEach((a, index) => {
        /**
         * Firebase free tier (lol) allows a maximum of 500 writes (in a db.batch)
         * for one request.  We make multiple requests if `activities.length` >
         * 500. My account had 542 activities... :)
         * @see https://stackoverflow.com/questions/61666244
         */
        if (0 === index % 500) {
          batch.commit();
          batch = db.batch();
        }
        batch.set(library.doc(a.id), a);
      });
      // TODO Add logId and timestamp to Activity during createLibraryFromLogs
      await batch.commit();
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid]);

  // Load `activities` and maintain up-to-date value
  useEffect(() => {
    db.user(user.uid)
      .collection(DbPath.UserActivityLibrary)
      .withConverter(DbConverter.Activity)
      .limit(50)
      .orderBy('name', 'asc')
      .onSnapshot(
        snapshot => setActivities(snapshot.docs.map(doc => doc.data())),
        err => setActivities(DataState.error(err.message))
      );
  }, [user.uid]);

  return (
    <Columns
      className={css`
        height: 100%;
      `}
    >
      <Typography
        variant="h6"
        className={css`
          padding: ${Pad.Medium} ${Pad.Large};
          border-bottom: 1px solid ${Color.ActionSecondaryGray};
        `}
      >
        Activity Library
      </Typography>
      <DataStateView data={activities}>
        {activities =>
          activities.length === 0 && DataState.isReady(hasLogs) && hasLogs ? (
            <div
              className={css`
                height: 100%;
                display: grid;
                place-items: center;
              `}
            >
              <Button
                onClick={createLibraryFromLogs}
                variant="contained"
                className={css`
                  width: 100%;
                `}
              >
                Create Library
              </Button>
            </div>
          ) : (
            <Columns
              className={css`
                height: 100%;
                overflow-y: scroll;
              `}
            >
              {activities.map(activity => (
                <Rows
                  key={activity.id}
                  between
                  className={css`
                    padding: ${Pad.Medium};
                    border-bottom: 1px solid ${Color.ActionSecondaryGray};
                  `}
                >
                  <Rows pad={Pad.Medium}>
                    <button
                      className={css`
                        color: ${Color.FontPrimary};
                        font-size: ${Font.Medium};
                        font-weight: 500;
                        padding: 0;
                        border: none;
                        background-color: transparent;
                        font-family: system-ui;
                        outline: none;
                        text-align: left;
                      `}
                      onClick={() => {
                        /** noop */
                      }}
                    >
                      {activity.name}
                    </button>
                  </Rows>
                  <Columns>
                    <p>{activity.id.slice(0, 5)}</p>
                    <p>{activity.weightUnit}</p>
                    <p>{activity.repCountUnit}</p>
                  </Columns>
                </Rows>
              ))}
            </Columns>
          )
        }
      </DataStateView>
    </Columns>
  );
};

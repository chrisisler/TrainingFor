import { css } from '@emotion/css';
import { Button, Typography } from '@material-ui/core';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { Activity } from '../interfaces';
import { Columns, Pad } from '../style';

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
      // TODO Add logId and timestamp to Activity during createLibraryFromLogs
      // Bulk-write the activites to the user Library collection
      const library = db.user(user.uid).collection(DbPath.UserActivityLibrary);
      const batch = db.batch();
      activities.forEach(a => batch.set(library.doc(a.id), a));
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
      .orderBy('name', 'desc')
      .onSnapshot(
        snapshot => setActivities(snapshot.docs.map(doc => doc.data())),
        err => setActivities(DataState.error(err.message))
      );
  }, [user.uid]);

  return (
    <Columns
      pad={Pad.Medium}
      className={css`
        height: 100%;
        overflow-y: scroll;
        padding: ${Pad.Medium} ${Pad.Large};
      `}
    >
      <Typography variant="h6">Activity Library</Typography>
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
            <div>
              <p> todo: render 'dem logs </p>
            </div>
          )
        }
      </DataStateView>
    </Columns>
  );
};

import React, { FC, useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Button, Typography } from '@material-ui/core';
import firebase from 'firebase/app';
import { useParams } from 'react-router-dom';

import { db, DbPath } from '../firebase';
import { Columns, Pad, Rows } from '../style';
import { Activity, TrainingLog } from '../interfaces';
import { useUser } from '../useUser';
import { DataState, DataStateView } from '../DataState';

const TrainingEntryContainer = styled(Columns)`
  padding: ${Pad.Large};
`;

const CreateActivityContainer = styled(Rows)`
  width: 100%;
`;

const CreateActivityInput = styled.input.attrs(() => ({
  type: 'text',
}))`
  box-sizing: content-box;
  width: 100%;
  padding: ${Pad.Medium};
  border: 1px solid lightgray;
  border-radius: 3px;
  font-size: 1em;
`;

export const TrainingEntry: FC = () => {
  const [activityName, setActivityName] = useState<string>('');

  const { logId } = useParams<{ logId: string }>();
  const [user] = useUser();

  /** Create a new Activity row to add ActivitySets to. */
  const addActivity = useCallback(
    <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      const newActivity: Omit<Activity, 'id'> = {
        name: activityName,
        sets: [],
        notes: null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
      db.collection(DbPath.Users)
        .doc(user?.uid)
        .collection(DbPath.UserLogs)
        .add(newActivity)
        .catch(error => {
          alert(error.message);
        });
    },
    [activityName, user?.uid]
  );

  return (
    <TrainingEntryContainer pad={Pad.Medium}>
      {/** Date */}
      <Typography variant="body1" color="textPrimary">
        Thu, Sep 17
        <br />
        2:20 PM
      </Typography>
      <CreateActivityContainer as="form" onSubmit={addActivity}>
        <CreateActivityInput
          placeholder="Enter activity name"
          value={activityName}
          onChange={event => setActivityName(event.target.value)}
        />
        {activityName.length > 0 && (
          <Button
            variant="outlined"
            color="primary"
            style={{ margin: `0 0 0 ${Pad.Medium}` }}
            onClick={addActivity}
          >
            Add
          </Button>
        )}
      </CreateActivityContainer>
    </TrainingEntryContainer>
  );
};

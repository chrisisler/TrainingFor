import styled from '@emotion/styled';
import { Button, Typography } from '@material-ui/core';
import firebase from 'firebase/app';
import React, { FC, useCallback } from 'react';
import { useHistory } from 'react-router-dom';

import { Paths } from '../constants';
import { db, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { TrainingLog } from '../interfaces';
import { Columns, Pad } from '../style';

const TrainingLogEditorContainer = styled.div`
  height: 100%;
  width: 100%;
  display: grid;
  place-items: center;
`;

export const NewTraining: FC = () => {
  const history = useHistory();
  const user = useUser();

  const addLog = useCallback(async () => {
    const newLog: Omit<TrainingLog, 'id'> = {
      title: 'Untitled',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      notes: null,
      authorId: user.uid,
    };
    try {
      const { id } = await db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserLogs)
        .add(newLog);
      history.push(Paths.logEditor(id));
    } catch (error) {
      alert(error.message);
    }
  }, [user.uid, history]);

  return (
    <TrainingLogEditorContainer>
      <Columns pad={Pad.Medium}>
        <Typography variant="h4" color="textPrimary" gutterBottom>
          Start Training
        </Typography>
        <Button variant="contained" color="primary" onClick={addLog}>
          Go
        </Button>
      </Columns>
    </TrainingLogEditorContainer>
  );
};

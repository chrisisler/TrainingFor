import React, { FC, useCallback } from 'react';
import { Typography, Button } from '@material-ui/core';
import styled from '@emotion/styled';
import firebase from 'firebase/app';
import { useHistory } from 'react-router-dom';

import { db, DbPath } from '../firebase';
import { TrainingLog } from '../interfaces';
import { Columns, Pad } from '../style';
import { useUser } from '../useUser';

const StartTrainingContainer = styled.div`
  height: 100%;
  width: 100%;
  display: grid;
  place-items: center;
`;

export const NewTraining: FC = () => {
  const history = useHistory();
  const [user] = useUser();

  const addLog = useCallback(() => {
    const newLog: Omit<TrainingLog, 'id'> = {
      title: '-',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      notes: null,
    };
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .add(newLog)
      .then(ref => {
        // setLogDoc(ref as firebase.firestore.DocumentReference<TrainingLog>);
        // return ref.get();
        // setLogData({ ...snapshot.data(), id: snapshot.id } as TrainingLog);
        history.push(`/log/${ref.id}`);
      })
      .catch(error => {
        alert(error.message);
      });
  }, [user?.uid, history]);

  return (
    <StartTrainingContainer>
      <Columns pad={Pad.Medium}>
        <Typography variant="h4" color="textPrimary" gutterBottom>
          Start Training
        </Typography>
        <Button variant="contained" color="primary" onClick={addLog}>
          Go
        </Button>
      </Columns>
    </StartTrainingContainer>
  );
};

import React, { FC, useCallback } from 'react';
import styled from 'styled-components';
import firebase from 'firebase/app';
import { Button, Typography } from '@material-ui/core';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  useHistory,
} from 'react-router-dom';

import { Columns, Pad, Rows } from '../style';
import { useUser } from '../useUser';
import { NavBar } from '../components/NavBar';
import { TrainingLog } from '../interfaces';
import { db, DbPath } from '../firebase';
import { TrainingEntry } from './TrainingEntry';

const StartTrainingContainer = styled.div`
  height: 100vh;
  width: 100%;
  display: grid;
  place-items: center;
`;

export const StartTraining: FC = () => {
  const [user] = useUser();
  const history = useHistory();

  const go = useCallback(() => {
    db.collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        notes: null,
        activities: [],
      } as Omit<TrainingLog, 'id'>)
      .then(docRef => {
        history.push(`/log/${docRef.id}`);
      })
      .catch(error => {
        alert(error.message);
      });
  }, [user?.uid, history]);

  return (
    <>
      <Router>
        <Switch>
          <Route exact path="/">
            <StartTrainingContainer>
              <Columns pad={Pad.Large}>
                <Typography variant="h4" color="textPrimary">
                  Training Log #1
                </Typography>
                <Button variant="contained" color="primary" onClick={go}>
                  Go
                </Button>
              </Columns>
            </StartTrainingContainer>
          </Route>
          <Route path="/log/:logId">
            <TrainingEntry />
          </Route>
        </Switch>
      </Router>
      <NavBar />
    </>
  );
};

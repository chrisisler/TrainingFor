import React, { FC, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Typography, CircularProgress, Button } from '@material-ui/core';
import firebase from 'firebase/app';
import format from 'date-fns/format';

import { Rows, Pad, Columns } from '../style';
import { useUser } from '../useUser';
import { db, DbPath } from '../firebase';
import { TrainingLog } from '../interfaces';
import { DataState, DataStateView } from '../DataState';

const AccountViewContainer = styled(Columns)`
  width: 100%;
  overflow-y: scroll;
`;

const CenteredContainer = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
`;

export const Account: FC = () => {
  const [logs, setLogs] = useState<DataState<TrainingLog[]>>(DataState.Loading);

  const [user] = useUser();

  useEffect(() => {
    if (!user) return;
    return db
      .collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        ({ docs }) =>
          setLogs(
            docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog))
          ),
        error => setLogs(DataState.error(error.message))
      );
  }, [user?.uid]);

  if (!user) return null;

  return (
    <AccountViewContainer>
      <Columns pad={Pad.Medium} padding={Pad.Large}>
        <Typography variant="h4" color="textSecondary">
          {user.displayName}
        </Typography>
        <Columns>
          <Typography variant="body1" color="textSecondary">
            Training Logs
          </Typography>
          <DataStateView
            data={logs}
            loading={() => (
              <CenteredContainer>
                <CircularProgress />
              </CenteredContainer>
            )}
            error={() => (
              <CenteredContainer>
                <Typography variant="body2" color="error">
                  Something went wrong.
                </Typography>
              </CenteredContainer>
            )}
          >
            {logs => (
              <Columns padding={Pad.Medium}>
                {logs.map(({ timestamp, id }) => {
                  const logDate = (timestamp as firebase.firestore.Timestamp)?.toDate();
                  return (
                    <Rows key={id}>
                      <Button href={`/${id}`}>
                        {format(logDate, 'EEE, M-d h:mm b')}
                      </Button>
                    </Rows>
                  );
                })}
              </Columns>
            )}
          </DataStateView>
        </Columns>
      </Columns>
    </AccountViewContainer>
  );
};

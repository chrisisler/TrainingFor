import React, { FC, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Typography, CircularProgress, IconButton } from '@material-ui/core';
import firebase from 'firebase/app';
import format from 'date-fns/format';

import { Rows, Pad, Columns } from '../style';
import { useUser } from '../useUser';
import { db, DbPath } from '../firebase';
import { TrainingLog } from '../interfaces';
import { DataState, DataStateView } from '../DataState';

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
  }, [user, user?.uid]);

  if (!user) return null;

  return (
    <Columns
      pad={Pad.Small}
      padding={Pad.Large}
      style={{ height: '100%', overflowY: 'scroll' }}
    >
      <Typography variant="h4" color="textSecondary" gutterBottom>
        {user.displayName}
      </Typography>
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
          <Columns padding={`0 0 0 ${Pad.Small}`}>
            {logs.map(({ id, title, timestamp }) => {
              const logDate = (timestamp as firebase.firestore.Timestamp)?.toDate();
              return (
                <Rows key={id}>
                  <IconButton href={`/${id}`}>
                    <Columns>
                      {title && (
                        <Typography variant="subtitle2">{title}</Typography>
                      )}
                      <Typography variant="body1">
                        {format(logDate, 'MMM d EEE h:mm a')}
                      </Typography>
                    </Columns>
                  </IconButton>
                </Rows>
              );
            })}
          </Columns>
        )}
      </DataStateView>
    </Columns>
  );
};

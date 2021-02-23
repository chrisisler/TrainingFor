import { css } from '@emotion/css';
import { Button } from '@material-ui/core';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import React, { FC, useMemo } from 'react';
import { useHistory } from 'react-router-dom';

import { Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useNewTraining, useUser } from '../hooks';
import { TrainingLog } from '../interfaces';
import { Columns, Pad } from '../style';

const trainingLabels = [
  'Go',
  'Go Mode',
  'Start training',
  'Get after it',
  'What are you waiting for?',
  "Let's fucking get it",
];

const randomFrom = <T extends unknown>(array: T[]): T =>
  array[Math.floor(Math.random() * array.length)];

export const NewTraining: FC = () => {
  const newTraining = useNewTraining();
  const user = useUser();
  const history = useHistory();

  const randomTrainingLabel = useMemo(() => randomFrom(trainingLabels), []);

  const [lastLog] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserLogs)
        .withConverter(DbConverter.TrainingLog)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then(({ empty, docs }) => (empty ? DataState.Empty : docs[0].data())),
    [user.uid]
  );

  const lastLogDay = DataState.map(
    lastLog,
    log => TrainingLog.getDate(log) ?? DataState.Empty
  );

  return (
    <div
      className={css`
        height: 100%;
        width: 100%;
        display: grid;
        place-items: center;
        padding: 0 ${Pad.Large};
      `}
    >
      <Columns
        pad={Pad.Medium}
        className={css`
          text-align: center;
        `}
        maxWidth
      >
        <Button
          variant="contained"
          color="primary"
          onClick={newTraining}
          size="large"
        >
          {randomTrainingLabel}
        </Button>
        <Button
          disabled={!DataState.isReady(lastLogDay)}
          variant="outlined"
          color="primary"
          onClick={() => {
            if (!DataState.isReady(lastLog)) return;
            history.push(Paths.logEditor(lastLog.id));
          }}
        >
          <DataStateView
            data={lastLogDay}
            loading={() => <>Loading previous...</>}
            error={() => null}
            empty={() => <>No previous training</>}
          >
            {lastLogDay => (
              <>
                Continue from{' '}
                {formatDistanceToNow(lastLogDay, {
                  addSuffix: true,
                  includeSeconds: true,
                })}
              </>
            )}
          </DataStateView>
        </Button>
      </Columns>
    </div>
  );
};

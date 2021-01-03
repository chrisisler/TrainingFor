import { css } from '@emotion/css';
import React, { FC } from 'react';
import { useParams } from 'react-router-dom';

import { TrainingLogView } from '../components/TrainingLogView';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';

export const TrainingLogViewPage: FC = () => {
  const { userId, logId } = useParams<{ userId?: string; logId?: string }>();

  const [log] = useDataState(
    () =>
      !userId || !logId
        ? Promise.reject(DataState.error('Invalid route params'))
        : db
            .collection(DbPath.Users)
            .doc(userId)
            .collection(DbPath.UserLogs)
            .withConverter(DbConverter.TrainingLog)
            .doc(logId)
            .get()
            .then(doc => {
              const log = doc.data();
              if (!log) {
                return DataState.error('TrainingLog document does not exist.');
              }
              // The viewed user is the author the viewed log
              log.authorId = userId;
              return log;
            }),
    [userId, logId]
  );

  return (
    <div
      className={css`
        height: 100%;
        width: 100%;
        overflow-y: scroll;
      `}
    >
      <DataStateView data={log} error={() => null}>
        {log => <TrainingLogView log={log} />}
      </DataStateView>
    </div>
  );
};

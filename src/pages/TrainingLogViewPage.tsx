import { css } from '@emotion/css';
import React, { FC } from 'react';
import { useParams } from 'react-router-dom';

import { TrainingLogView } from '../components';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';

/**
 * Read-only presentation of a TrainingLog/Template.
 *
 * When viewing one's own log or template , the Editor page is used, not this.
 */
export const TrainingLogViewPage: FC = () => {
  const { userId, logId, templateId } = useParams<{
    userId?: string;
    logId?: string;
    templateId?: string;
  }>();

  const isTemplate = !!templateId;

  const [log] = useDataState(
    () =>
      db
        .user(userId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .withConverter(isTemplate ? DbConverter.TrainingTemplate : DbConverter.TrainingLog)
        .doc(templateId ?? logId)
        .get()
        .then(doc => doc.data() ?? DataState.Empty),
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
      <DataStateView data={log}>{log => <TrainingLogView log={log} />}</DataStateView>
    </div>
  );
};

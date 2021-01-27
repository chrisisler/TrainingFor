import { css } from '@emotion/css';
import { LinearProgress } from '@material-ui/core';
import React, { FC } from 'react';

export const Loading: FC = () => {
  return (
    <div
      className={css`
        width: 100%;
        height: 100%;
      `}
    >
      <LinearProgress
        variant="indeterminate"
        className={css`
          position: absolute;
          top: 50%;
          margin: 0 auto;
          transform: translateY(-50%);
          max-width: 128px;
        `}
      />
    </div>
  );
};

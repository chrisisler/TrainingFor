import { css } from '@emotion/css';
import { CircularProgress } from '@material-ui/core';
import React, { FC } from 'react';

export const Loading: FC = () => {
  return (
    <div
      className={css`
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
      `}
    >
      <CircularProgress />
    </div>
  );
};

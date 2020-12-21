import React, { FC } from 'react';
import { CircularProgress } from '@material-ui/core';
import { css } from '@emotion/css';

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

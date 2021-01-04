import { css } from '@emotion/css';
import React, { FC } from 'react';

export const Sorry: FC = () => {
  return (
    <div
      className={css`
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
      `}
    >
      <p
        className={css`
          font-size: 1em;
          font-style: italic;
        `}
      >
        Sorry! Something went wrong.
      </p>
    </div>
  );
};

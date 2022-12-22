import { css } from '@emotion/css';
import React, { FC, } from 'react';

import { Columns, Pad } from '../style';

export const NewTraining: FC = () => {

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
      </Columns>
    </div>
  );
};

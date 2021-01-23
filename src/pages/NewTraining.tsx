import { css } from '@emotion/css';
import { Button, Typography } from '@material-ui/core';
import React, { FC } from 'react';

import { useNewTraining } from '../hooks';
import { Columns, Pad } from '../style';

export const NewTraining: FC = () => {
  const newTraining = useNewTraining();

  return (
    <div
      className={css`
        height: 100%;
        width: 100%;
        display: grid;
        place-items: center;
      `}
    >
      <Columns pad={Pad.Medium}>
        <Typography variant="h4" color="textPrimary" gutterBottom>
          Start Training
        </Typography>
        <Button variant="contained" color="primary" onClick={newTraining}>
          Go
        </Button>
      </Columns>
    </div>
  );
};

import styled from '@emotion/styled';
import { Button, Typography } from '@material-ui/core';
import React, { FC } from 'react';

import { useNewTraining } from '../hooks';
import { Columns, Pad } from '../style';

const TrainingLogEditorContainer = styled.div`
  height: 100%;
  width: 100%;
  display: grid;
  place-items: center;
`;

export const NewTraining: FC = () => {
  const newTraining = useNewTraining();

  return (
    <TrainingLogEditorContainer>
      <Columns pad={Pad.Medium}>
        <Typography variant="h4" color="textPrimary" gutterBottom>
          Start Training
        </Typography>
        <Button variant="contained" color="primary" onClick={newTraining}>
          Go
        </Button>
      </Columns>
    </TrainingLogEditorContainer>
  );
};

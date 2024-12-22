import { Box, LinearProgress } from '@mui/material';
import { FC } from 'react';

export const Loading: FC = () => {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      <LinearProgress
        variant="indeterminate"
        sx={{
          position: 'absolute',
          top: '50%',
          margin: '0 auto',
          transform: 'rotate(90deg)',
          maxWidth: '16px',
        }}
      />
    </Box>
  );
};

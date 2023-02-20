import { Add, MenuBook } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { API } from '../api';
import { useUser } from '../context';
import { TrainingLog } from '../types';
import { Paths, useToast } from '../util';

export const Account: FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();

  const startNewTrainingLog = useCallback(async () => {
    try {
      const entry: TrainingLog = await API.TrainingLogs.create({
        timestamp: Date.now(),
        authorUserId: user.uid,
        id: '',
      });
      navigate(Paths.editor(entry.id));
      toast.success('Training log created successfully.');
    } catch (err) {
      toast.error(err.message);
    }
  }, [user.uid, navigate, toast]);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        padding: theme => theme.spacing(2),
      }}
    >
      <Typography variant="overline">Account Page</Typography>
      {/** Account button */}
      <Button
        fullWidth
        size="large"
        variant="contained"
        startIcon={<Add />}
        onClick={startNewTrainingLog}
      >
        Log
      </Button>
      {/** List of Training Logs */}
    </Box>
  );
};

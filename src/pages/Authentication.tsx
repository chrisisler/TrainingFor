import { Google, Person } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { Authenticate } from '../api';
import { Paths, useToast, useUserAuthSubscription } from '../util';

export const Authentication: FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [, setUser] = useUserAuthSubscription();

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'grid',
        placeItems: 'center',
        padding: theme => theme.spacing(1),
      }}
    >
      <Stack
        spacing={6}
        sx={{
          padding: theme => theme.spacing(0, 4),
          textAlign: 'left',
        }}
      >
        <Typography sx={{ fontFamily: 'monospace', fontStyle: 'italic' }}>
          Trainquil Logo
        </Typography>
        <Typography variant="h6">
          Start training and track your progression. Join Trainquil today.
        </Typography>
        <Stack spacing={3}>
          <Button
            variant="contained"
            startIcon={<Google />}
            onClick={async () => {
              try {
                const authResult = await Authenticate.withGoogle();
                setUser(authResult.user);
                navigate(Paths.home);
                toast.info('Welcome!');
              } catch (error) {
                toast.error(error.message);
              }
            }}
          >
            Sign In with Google
          </Button>
          <Button
            variant="outlined"
            startIcon={<Person />}
            onClick={async () => {
              try {
                await Authenticate.anonymously();
                navigate(Paths.home);
                toast.info('Welcome!');
              } catch (error) {
                toast.error(error.message);
              }
            }}
          >
            Sign In Anonymously
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

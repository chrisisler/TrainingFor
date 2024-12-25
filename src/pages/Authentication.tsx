import { Google, Person } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Authenticate, useAuthStore } from '../api';
import { Paths, useToast } from '../util';

import logo192 from '../logo192.png';

export const Authentication: FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const setUser = useAuthStore(store => store.setUser);

  useEffect(() => {
    document.title = 'Log In - Trainquil';
  }, []);

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
        <Stack direction="row" spacing={2} alignItems="center" width="100" margin="0 auto">
          <img src={logo192} alt="Trainquil Logo" height={64} width={64} />
          <Typography variant="overline" fontStyle="italic">
            Trainquil
          </Typography>
        </Stack>

        <Typography>
          Start training and track your progression. <br />
          Join today.
        </Typography>

        <Stack spacing={3}>
          <Button
            variant="contained"
            startIcon={<Google />}
            onClick={async () => {
              try {
                const authResult = await Authenticate.withGoogle();

                setUser(authResult.user);
                navigate(Paths.editor(''));
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

                navigate(Paths.editor(''));
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

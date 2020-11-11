import React, { FC } from 'react';
import styled from 'styled-components';
import { Typography } from '@material-ui/core';

import { Rows, Pad, Columns } from '../style';
import { useUser } from '../useUser';

const AccountViewContainer = styled(Columns)`
  width: 100%;
  overflow-y: scroll;
`;

export const Account: FC = () => {
  const [user] = useUser();

  return (
    <AccountViewContainer>
      <Typography variant="h1" color="textPrimary">
        Account
      </Typography>
    </AccountViewContainer>
  );
};

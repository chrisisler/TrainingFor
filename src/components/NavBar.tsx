import React, { FC } from 'react';
import styled from 'styled-components';
import { Add, Person, List } from '@material-ui/icons';

import { Rows, Pad } from '../style';
import { IconButton } from '@material-ui/core';

const NavBarContainer = styled(Rows)`
  justify-content: space-between;
  position: fixed;
  background-color: #fff;
  bottom: 0;
  padding: ${Pad.Small} ${Pad.Large};
  width: 100%;
  border-top: 1px solid lightgray;
`;

export const NavBar: FC = () => {
  return (
    <NavBarContainer as="nav">
      <IconButton aria-label="Navigate to timeline">
        <List />
      </IconButton>
      <IconButton aria-label="Start Training">
        <Add />
      </IconButton>
      <IconButton aria-label="Navigate to account">
        <Person />
      </IconButton>
    </NavBarContainer>
  );
};

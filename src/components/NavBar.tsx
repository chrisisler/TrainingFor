import React, { FC } from 'react';
import styled from '@emotion/styled';
import { Add, Person, List } from '@material-ui/icons';
import { IconButton } from '@material-ui/core';

import { Rows, Pad } from '../style';

export const navBarHeight: number = 50;

const NavBarContainer = styled(Rows)`
  justify-content: space-between;
  position: fixed;
  background-color: #fff;
  bottom: 0;
  padding: 0 ${Pad.Large};
  height: ${navBarHeight}px;
  width: 100%;
  border-top: 1px solid lightgray;
`;

export const NavBar: FC = () => {
  return (
    <NavBarContainer as="nav">
      <IconButton aria-label="Navigate to timeline" href="timeline">
        <List />
      </IconButton>
      <IconButton aria-label="Start Training" href="/">
        <Add />
      </IconButton>
      <IconButton aria-label="Navigate to account" href="account">
        <Person />
      </IconButton>
    </NavBarContainer>
  );
};

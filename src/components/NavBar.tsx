import React, { FC } from 'react';
import styled from '@emotion/styled';
import { Add, Person, List } from '@material-ui/icons';
import { IconButton, Link } from '@material-ui/core';
import { NavLink } from 'react-router-dom';
import { css } from '@emotion/css';

import { Rows, Pad } from '../style';
import { Paths } from '../constants';

export const navBarHeight = 50;

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

const linkStyle = css`
  color: #555 !important;
`;

export const NavBar: FC = () => {
  return (
    <NavBarContainer as="nav">
      <IconButton aria-label="Navigate to timeline">
        <Link component={NavLink} className={linkStyle} to={Paths.timeline}>
          <List />
        </Link>
      </IconButton>
      <IconButton aria-label="Start Training">
        <Link component={NavLink} className={linkStyle} to={Paths.newTraining}>
          <Add />
        </Link>
      </IconButton>
      <IconButton aria-label="Navigate to account">
        <Link component={NavLink} className={linkStyle} to={Paths.account}>
          <Person />
        </Link>
      </IconButton>
    </NavBarContainer>
  );
};

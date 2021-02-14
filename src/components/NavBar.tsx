import { css } from '@emotion/css';
import styled from '@emotion/styled';
import { IconButton, Link } from '@material-ui/core';
import { ClearAll, Create, Person } from '@material-ui/icons';
import React, { FC, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Paths } from '../constants';
import { Pad, Rows } from '../style';

const navBarHeight = 50;

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

export const ViewWithNavBar: FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div
    className={css`
      width: 100%;
      height: calc(100% - ${navBarHeight}px);
    `}
  >
    {children}
    <NavBar />
  </div>
);

const NavBar: FC = () => {
  const { pathname } = useLocation();

  // This is to highlight the active navigation
  const linkStyle = useCallback(
    (path: string) =>
      css`
        color: ${pathname === path ? 'gray' : 'lightgray'} !important;
      `,
    [pathname]
  );

  return (
    <NavBarContainer as="nav">
      <IconButton aria-label="Navigate to timeline">
        <Link
          component={NavLink}
          className={linkStyle(Paths.timeline)}
          to={Paths.timeline}
        >
          <ClearAll />
        </Link>
      </IconButton>
      <IconButton aria-label="Start Training">
        <Link
          component={NavLink}
          className={linkStyle(Paths.newTraining)}
          to={Paths.newTraining}
        >
          <Create />
        </Link>
      </IconButton>
      <IconButton aria-label="Navigate to account">
        <Link
          component={NavLink}
          className={linkStyle(Paths.account)}
          to={Paths.account}
        >
          <Person />
        </Link>
      </IconButton>
    </NavBarContainer>
  );
};

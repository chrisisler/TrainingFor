import { css } from '@emotion/css';
import { IconButton, Link } from '@material-ui/core';
import { Create, Forum, Person } from '@material-ui/icons';
import React, { FC, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Paths } from '../constants';
import { Color, Pad } from '../style';

const navBarHeight = 65;

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

  const linkStyle = useCallback(
    (path: string) =>
      css`
        color: ${pathname === path ? '#222' : 'darkgray'} !important;
      `,
    [pathname]
  );

  return (
    <nav
      className={css`
        display: flex;
        justify-content: space-between;
        position: fixed;
        background-color: #fff;
        bottom: 0;
        padding: 0 ${Pad.Large} ${Pad.Medium};
        height: ${navBarHeight}px;
        width: 100%;
        border-top: 1px solid ${Color.ActionSecondaryGray};
        max-width: 512px;
      `}
    >
      <IconButton aria-label="Navigate to timeline">
        <Link
          component={NavLink}
          className={linkStyle(Paths.timeline)}
          to={Paths.timeline}
        >
          <Forum />
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
    </nav>
  );
};

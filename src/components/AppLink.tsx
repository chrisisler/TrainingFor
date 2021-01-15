import { css, cx } from '@emotion/css';
import { Link } from '@material-ui/core';
import React, { FC, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const style = css`
  color: rgba(0, 0, 0, 0.87) !important;
  text-decoration: underline !important;
`;

/**
 * Provides a link which routes the user to a route within the application.
 *
 * @param to The target url.
 * @param className Optional extra styles.
 */
export const AppLink: FC<{
  to: string;
  children: ReactNode;
  className?: string;
}> = ({ to, children, className = '' }) => (
  <Link component={NavLink} to={to} className={cx(style, className)}>
    {children}
  </Link>
);

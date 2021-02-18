import { css, cx } from '@emotion/css';
import { Link } from '@material-ui/core';
import React, { FC, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { Color } from '../style';

const style = css`
  color: ${Color.FontPrimary} !important;
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

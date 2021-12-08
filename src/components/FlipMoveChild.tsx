import React, { forwardRef, ReactNode } from 'react';

export const FlipMoveChild = forwardRef<HTMLDivElement, { children: ReactNode }>((props, ref) => (
  <div ref={ref}>{props.children}</div>
));

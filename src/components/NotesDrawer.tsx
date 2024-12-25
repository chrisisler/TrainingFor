import { Box, InputBase } from '@mui/material';
import { FC, useState } from 'react';
import ReactFocusLock from 'react-focus-lock';

export const NotesDrawer: FC<{
  note: string;
  /** Function to update onBlur. `note` is the final value. */
  onBlur(note: string): void;
  sx?: React.CSSProperties;
  noFocusLock?: boolean;
}> = ({ note, onBlur, sx = {}, noFocusLock = false }) => {
  const [state, setState] = useState(note);

  return (
    <Box sx={{ height: '70vh', overflowY: 'scroll', ...sx }}>
      <ReactFocusLock returnFocus disabled={noFocusLock}>
        <InputBase
          multiline
          fullWidth
          minRows={4}
          placeholder="Note"
          value={state}
          onChange={event => setState(event.target.value)}
          onBlur={() => {
            if (state === note) {
              return;
            }
            onBlur(state);
          }}
        />
      </ReactFocusLock>
    </Box>
  );
};

import { Box, InputBase } from '@mui/material';
import { FC, useState } from 'react';
import ReactFocusLock from 'react-focus-lock';

export const NotesDrawer: FC<{
  note: string;
  /** Function to update onBlur. `note` is the final value. */
  onBlur(note: string): void;
}> = ({ note, onBlur }) => {
  const [state, setState] = useState(note);

  return (
    <Box sx={{ height: '60vh', overflowY: 'scroll' }}>
      <ReactFocusLock returnFocus>
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

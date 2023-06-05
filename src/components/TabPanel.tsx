import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';

// https://mui.com/material-ui/react-tabs/
export const TabPanel: FC<{
  children: ReactNode;
  index: number;
  value: number;
}> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`program-tabpanel-${index}`}
    aria-labelledby={`program-tab-${index}`}
  >
    {value === index && (
      <Box
        sx={{
          padding: theme => theme.spacing(3, 1),
        }}
      >
        {children}
      </Box>
    )}
  </div>
);

// https://mui.com/material-ui/react-tabs/
export function tabA11yProps(index: number) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

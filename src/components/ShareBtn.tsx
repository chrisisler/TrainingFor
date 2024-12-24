import { IosShareRounded } from "@mui/icons-material";
import { useMediaQuery, IconButton, useTheme, Button } from "@mui/material";
import { FC } from "react"

export const ShareBtn: FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const onClick = () => {
    console.warn('Unimplemented: share btn/panel feature');
  };

  return (
    <>
      {isMobile ? (
        <IconButton onClick={onClick}>
          <IosShareRounded sx={{ color: 'text.secondary' }} />
        </IconButton>
      ) : (
        <Button
          onClick={onClick}
          sx={{
            color: theme => theme.palette.text.primary,
            letterSpacing: 0,
            fontWeight: 500,
          }}
        >
          Share
        </Button>
      )}
    </>
  );
};

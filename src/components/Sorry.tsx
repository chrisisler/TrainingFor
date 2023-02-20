import { Box, Typography } from "@mui/material";
import { FC } from "react";

export const Sorry: FC = () => {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Typography sx={{ fontStyle: "italic" }}>
        Sorry! Something went wrong.
      </Typography>
    </Box>
  );
};

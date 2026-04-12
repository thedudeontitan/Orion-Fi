import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import React from "react";
import type { ConfirmationModalProps } from "./type";

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onConfirm,
  onCancel,
  trade,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{
        sx: {
          backgroundColor: "#ffffff",
          border: "1px solid rgba(124, 58, 237, 0.16)",
          borderRadius: "16px",
          color: "#5b21b6",
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: "rgba(91, 33, 182, 0.2)",
          backdropFilter: "blur(4px)",
        },
      }}
    >
      <DialogTitle
        sx={{ color: "#5b21b6", fontWeight: 600, fontSize: "1.1rem", pb: 1 }}
      >
        Confirm Trade
      </DialogTitle>
      <DialogContent sx={{ width: "20vw", minWidth: "280px" }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: "#5b21b6", mb: 1 }}
        >
          {trade.contractSize} {trade.symbol}
        </Typography>
        <Typography
          sx={{ color: "rgba(91, 33, 182, 0.6)", fontSize: "0.9rem" }}
        >
          Price: {trade.limitPrice}
        </Typography>
        <Typography
          sx={{ color: "rgba(91, 33, 182, 0.6)", fontSize: "0.9rem" }}
        >
          {trade.symbol}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={onCancel}
          sx={{
            flex: 1,
            color: "rgba(91, 33, 182, 0.7)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            borderRadius: "12px",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": {
              backgroundColor: "rgba(124, 58, 237, 0.08)",
              borderColor: "rgba(124, 58, 237, 0.28)",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          sx={{
            flex: 1,
            background: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
            color: "#ffffff",
            borderRadius: "12px",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": {
              background: "linear-gradient(135deg, #8b5cf6 0%, #c4b5fd 100%)",
            },
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;

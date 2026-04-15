/**
 * Vault withdraw modal — burn LP shares and receive USDC (minus withdrawal fee).
 *
 * Uses a percentage slider 0–100% to choose how much of the user's balance to burn.
 */
import { useMemo, useState, useEffect } from "react";
import { Dialog } from "@mui/material";
import { motion } from "framer-motion";
import { useLpPosition } from "../../hooks/algorand/useLpPosition";
import { useVaultWithdraw } from "../../hooks/algorand/useVaultWithdraw";
import { formatUsdc } from "../../services/algorand/usdc";
import {
  SHARE_PRECISION,
  BASIS_POINTS,
  VAULT_WITHDRAWAL_FEE_BPS,
} from "../../services/algorand/config";
import { useNotification, parseAlgoError } from "../../hooks/useNotification";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WithdrawModal({ open, onClose }: Props) {
  const [percent, setPercent] = useState<number>(25);
  const { data: lp } = useLpPosition();
  const withdraw = useVaultWithdraw();
  const {
    transactionSubmitNotification,
    successNotification,
    errorNotification,
  } = useNotification();

  // Reset the slider each time the modal opens.
  useEffect(() => {
    if (open) setPercent(25);
  }, [open]);

  const totalShares = lp?.position?.shares ?? 0n;
  const totalValue = lp?.valueMicroUsdc ?? 0n;

  const sharesToBurn = useMemo(() => {
    if (totalShares <= 0n) return 0n;
    return (totalShares * BigInt(percent)) / 100n;
  }, [totalShares, percent]);

  // Gross value = value * (sharesToBurn / totalShares). Net = gross * (1 - fee).
  const { grossMicro, netMicro, feeMicro } = useMemo(() => {
    if (totalShares <= 0n || sharesToBurn <= 0n) {
      return { grossMicro: 0n, netMicro: 0n, feeMicro: 0n };
    }
    const gross = (totalValue * sharesToBurn) / totalShares;
    const fee = (gross * VAULT_WITHDRAWAL_FEE_BPS) / BASIS_POINTS;
    return { grossMicro: gross, netMicro: gross - fee, feeMicro: fee };
  }, [totalValue, totalShares, sharesToBurn]);

  const handleWithdraw = async () => {
    if (sharesToBurn <= 0n) {
      errorNotification("Select a percentage to withdraw");
      return;
    }
    try {
      const result = await withdraw.mutateAsync({ sharesToBurn });
      transactionSubmitNotification(result.txId);
      successNotification(
        <span>
          Withdrew ${formatUsdc(result.payoutMicroUsdc)} (burned{" "}
          {(Number(sharesToBurn) / Number(SHARE_PRECISION)).toFixed(4)} shares)
        </span>,
      );
      onClose();
    } catch (err) {
      errorNotification(parseAlgoError(err));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          backgroundColor: "#12141a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          color: "#ffffff",
          width: "100%",
          maxWidth: "440px",
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: "rgba(10,11,13,0.7)",
          backdropFilter: "blur(4px)",
        },
      }}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-white">
            Withdraw from Vault
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {totalShares <= 0n ? (
          <div className="py-6 text-center text-sm text-white/40">
            You have no LP shares to withdraw.
          </div>
        ) : (
          <>
            {/* Position summary */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                  Your Shares
                </div>
                <div className="text-sm text-white font-mono">
                  {(Number(totalShares) / Number(SHARE_PRECISION)).toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                  Current Value
                </div>
                <div className="text-sm text-white font-mono">
                  ${formatUsdc(totalValue)}
                </div>
              </div>
            </div>

            {/* Percent slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-white/30 uppercase tracking-wider">
                  Amount to withdraw
                </label>
                <span className="text-sm font-semibold text-white bg-white/[0.04] px-2 py-0.5 rounded-lg">
                  {percent}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer leverage-slider"
                style={{
                  background:
                    "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
                }}
              />
              <div className="grid grid-cols-4 gap-2 mt-1">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPercent(p)}
                    className={`py-1.5 text-[11px] rounded-lg border transition-colors ${
                      percent === p
                        ? "border-white/20 bg-white/[0.08] text-white"
                        : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:text-white"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Shares to burn</span>
                <span className="text-white font-mono">
                  {(Number(sharesToBurn) / Number(SHARE_PRECISION)).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Gross payout</span>
                <span className="text-white/70 font-mono">
                  ${formatUsdc(grossMicro)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">
                  Withdrawal fee (
                  {(Number(VAULT_WITHDRAWAL_FEE_BPS) / 100).toFixed(2)}%)
                </span>
                <span className="text-white/50 font-mono">
                  −${formatUsdc(feeMicro)}
                </span>
              </div>
              <div className="border-t border-white/[0.04] pt-2 flex justify-between text-sm">
                <span className="text-white font-semibold">You receive</span>
                <span className="text-white font-mono font-semibold">
                  ${formatUsdc(netMicro)}
                </span>
              </div>
            </div>

            <motion.button
              onClick={handleWithdraw}
              disabled={withdraw.isPending || sharesToBurn <= 0n}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              }}
              whileHover={!withdraw.isPending ? { scale: 1.01 } : {}}
              whileTap={!withdraw.isPending ? { scale: 0.98 } : {}}
            >
              {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
            </motion.button>
          </>
        )}
      </div>
    </Dialog>
  );
}

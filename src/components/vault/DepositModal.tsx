/**
 * Vault deposit modal — lets an LP add USDC and receive shares.
 *
 * Dark MUI Dialog matching the app theme. Body is gated by UsdcOptInGate
 * so new wallets are prompted to opt into USDC before depositing.
 */
import { useMemo, useState } from "react";
import { Dialog } from "@mui/material";
import { motion } from "framer-motion";
import { UsdcOptInGate } from "../usdc/UsdcOptInGate";
import { useUsdcBalance } from "../../hooks/algorand/useUsdcBalance";
import { useVaultDeposit } from "../../hooks/algorand/useVaultDeposit";
import { useSharePrice } from "../../hooks/algorand/usePoolState";
import { parseUsdcAmount, formatUsdc } from "../../services/algorand/usdc";
import { SHARE_PRECISION } from "../../services/algorand/config";
import { useNotification, parseAlgoError } from "../../hooks/useNotification";

interface Props {
  open: boolean;
  onClose: () => void;
}

function estimateShares(
  amountMicroUsdc: bigint,
  sharePrice: bigint | null | undefined,
): bigint | null {
  if (!sharePrice || sharePrice <= 0n || amountMicroUsdc <= 0n) return null;
  // sharePrice is microUSDC per share scaled by SHARE_PRECISION (1e6).
  // shares = (amount * SHARE_PRECISION) / sharePrice
  return (amountMicroUsdc * SHARE_PRECISION) / sharePrice;
}

export function DepositModal({ open, onClose }: Props) {
  const [amount, setAmount] = useState<string>("");
  const { data: balance } = useUsdcBalance();
  const { data: sharePrice } = useSharePrice();
  const deposit = useVaultDeposit();
  const {
    transactionSubmitNotification,
    successNotification,
    errorNotification,
  } = useNotification();

  const amountMicroUsdc = useMemo(
    () => (amount ? parseUsdcAmount(amount) : null),
    [amount],
  );

  const estShares = useMemo(
    () =>
      amountMicroUsdc !== null ? estimateShares(amountMicroUsdc, sharePrice) : null,
    [amountMicroUsdc, sharePrice],
  );

  const balanceMicro = balance?.balance ?? 0n;
  const exceedsBalance =
    amountMicroUsdc !== null && amountMicroUsdc > balanceMicro;

  const handleMax = () => {
    setAmount(formatUsdc(balanceMicro, 6));
  };

  const handleDeposit = async () => {
    if (amountMicroUsdc === null) {
      errorNotification("Enter a valid USDC amount");
      return;
    }
    if (exceedsBalance) {
      errorNotification("Amount exceeds USDC balance");
      return;
    }
    try {
      const result = await deposit.mutateAsync({ amountMicroUsdc });
      transactionSubmitNotification(result.txId);
      successNotification(
        <span>
          Deposited ${formatUsdc(amountMicroUsdc)} — received{" "}
          {(Number(result.shares) / Number(SHARE_PRECISION)).toFixed(4)} shares
        </span>,
      );
      setAmount("");
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
          <div className="text-lg font-semibold text-white">Deposit USDC</div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        <UsdcOptInGate>
          {/* Amount */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-white/30 uppercase tracking-wider">
                Amount
              </label>
              <button
                onClick={handleMax}
                className="text-[10px] text-white/50 hover:text-white uppercase tracking-wider"
              >
                Balance: ${formatUsdc(balanceMicro)} · MAX
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/30 focus:border-white/20 outline-none transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="text-white/40 font-medium text-xs bg-white/[0.04] px-2 py-1 rounded-lg">
                  USDC
                </span>
              </div>
            </div>
            {exceedsBalance && (
              <div className="text-xs text-danger">
                Amount exceeds available balance
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Estimated shares</span>
              <span className="text-white font-mono">
                {estShares === null
                  ? "—"
                  : (Number(estShares) / Number(SHARE_PRECISION)).toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Share price</span>
              <span className="text-white/70 font-mono">
                {sharePrice
                  ? `$${(Number(sharePrice) / Number(SHARE_PRECISION)).toFixed(4)}`
                  : "—"}
              </span>
            </div>
          </div>

          <motion.button
            onClick={handleDeposit}
            disabled={
              deposit.isPending || amountMicroUsdc === null || exceedsBalance
            }
            className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            }}
            whileHover={!deposit.isPending ? { scale: 1.01 } : {}}
            whileTap={!deposit.isPending ? { scale: 0.98 } : {}}
          >
            {deposit.isPending ? "Depositing…" : "Deposit"}
          </motion.button>
        </UsdcOptInGate>
      </div>
    </Dialog>
  );
}

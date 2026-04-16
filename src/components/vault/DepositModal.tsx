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

interface PanelProps {
  onSuccess?: () => void;
  variant?: "inline" | "modal";
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

export function VaultDepositPanel({
  onSuccess,
  variant = "inline",
}: PanelProps) {
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
  const isInline = variant === "inline";

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
      onSuccess?.();
    } catch (err) {
      errorNotification(parseAlgoError(err));
    }
  };

  return (
    <div className={isInline ? "space-y-5" : "space-y-4"}>
      {!isInline && <div className="text-lg font-semibold text-white">Deposit USDC</div>}

      <UsdcOptInGate>
        <div
          className={
            isInline
              ? "rounded-2xl border border-amber-500/25 bg-amber-50 p-4 space-y-2"
              : "rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 space-y-2"
          }
        >
          <div
            className={
              isInline
                ? "text-[10px] uppercase tracking-[0.2em] text-amber-700"
                : "text-[10px] uppercase tracking-[0.2em] text-amber-200/80"
            }
          >
            Disclaimer
          </div>
          <p
            className={
              isInline
                ? "text-sm leading-6 text-amber-900/80"
                : "text-sm leading-6 text-amber-50/85"
            }
          >
            Vault deposits act as counterparty liquidity for perpetual traders.
            Profitable traders are paid from this pool, and losses remain in the
            vault. Deposit only capital you are comfortable putting at market
            risk.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label
              className={
                isInline
                  ? "text-[10px] text-accent-dark/45 uppercase tracking-wider"
                  : "text-[10px] text-white/30 uppercase tracking-wider"
              }
            >
              Amount
            </label>
            <button
              onClick={handleMax}
              className={
                isInline
                  ? "text-[10px] text-accent-dark/55 hover:text-accent-dark uppercase tracking-wider"
                  : "text-[10px] text-white/50 hover:text-white uppercase tracking-wider"
              }
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
              className={
                isInline
                  ? "w-full px-4 py-3 text-sm rounded-xl bg-white border border-accent/[0.14] text-accent-dark placeholder-accent-dark/30 focus:border-accent/[0.35] outline-none transition-colors"
                  : "w-full px-4 py-3 text-sm rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/30 focus:border-white/20 outline-none transition-colors"
              }
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span
                className={
                  isInline
                    ? "text-accent-dark/50 font-medium text-xs bg-accent/[0.06] px-2 py-1 rounded-lg"
                    : "text-white/40 font-medium text-xs bg-white/[0.04] px-2 py-1 rounded-lg"
                }
              >
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

        <div
          className={
            isInline
              ? "rounded-xl bg-accent/[0.03] border border-accent/[0.08] p-4 space-y-3"
              : "rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-2"
          }
        >
          <div className="flex justify-between text-xs">
            <span className={isInline ? "text-accent-dark/55" : "text-white/40"}>
              Estimated shares
            </span>
            <span className={isInline ? "text-accent-dark font-mono" : "text-white font-mono"}>
              {estShares === null
                ? "—"
                : (Number(estShares) / Number(SHARE_PRECISION)).toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className={isInline ? "text-accent-dark/55" : "text-white/40"}>
              Share price
            </span>
            <span
              className={
                isInline ? "text-accent-dark/80 font-mono" : "text-white/70 font-mono"
              }
            >
              {sharePrice
                ? `$${(Number(sharePrice) / Number(SHARE_PRECISION)).toFixed(4)}`
                : "—"}
            </span>
          </div>
        </div>

        <motion.button
          onClick={handleDeposit}
          disabled={deposit.isPending || amountMicroUsdc === null || exceedsBalance}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
          whileHover={!deposit.isPending ? { scale: 1.01 } : {}}
          whileTap={!deposit.isPending ? { scale: 0.98 } : {}}
        >
          {deposit.isPending ? "Depositing…" : "Deposit To Vault"}
        </motion.button>
      </UsdcOptInGate>
    </div>
  );
}

export function DepositModal({ open, onClose }: Props) {
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
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-white">Deposit USDC</div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>
        <VaultDepositPanel onSuccess={onClose} variant="modal" />
      </div>
    </Dialog>
  );
}

import { ReactNode, useRef } from "react";

import { toast, Id, TypeOptions } from "react-toastify";
import { renderTransactionId } from "../lib.tsx";

/**
 * Turn a raw Algorand/algokit error into a short human-readable string.
 * Strips TEAL preambles and surfaces the assert message when present.
 */
export function parseAlgoError(err: unknown): string {
  if (err === null || err === undefined) return "Unknown error";
  const raw = err instanceof Error ? err.message : String(err);

  // Common TEAL/simulate preamble: "logic eval error: <msg>. Details: ..."
  const evalMatch = raw.match(/logic eval error:\s*([^.]+)/i);
  if (evalMatch) return evalMatch[1].trim();

  // Assert messages are often ErrorMessage format
  const assertMatch = raw.match(/assert(?:ion)? failed(?:\s*:)?\s*(.+?)(?:\n|$)/i);
  if (assertMatch) return assertMatch[1].trim();

  // Strip PC/opcode position noise at the tail of some messages
  const trimmed = raw.split("\n")[0]?.trim() ?? raw;
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
}

/**
 * Hook to handle app notifications
 */
export const useNotification = () => {
  const notification = useRef<Id | null>(null);

  const onClose = () => {
    notification.current = null;
  };

  const showNotification = (render: string | ReactNode, type: TypeOptions) => {
    if (notification.current) {
      toast.update(notification.current, { render, type, onClose });
    } else {
      notification.current =
        type === "default"
          ? toast.info(render, { onClose })
          : toast[type](render, { onClose });
    }
  };

  return {
    infoNotification: (render: string | ReactNode) =>
      showNotification(render, "info"),
    successNotification: (render: string | ReactNode) =>
      showNotification(render, "success"),
    errorNotification: (render: string | ReactNode) =>
      showNotification(render, "error"),
    transactionSubmitNotification: (transactionId: string) =>
      showNotification(
        <span>
          Transaction submitted: {renderTransactionId(transactionId)}
        </span>,
        "info",
      ),
    transactionSuccessNotification: (transactionId: string) =>
      showNotification(
        <span>
          Transaction successful: {renderTransactionId(transactionId)}
        </span>,
        "success",
      ),
  };
};

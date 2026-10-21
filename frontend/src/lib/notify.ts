import { toast } from "sonner";
import { ApiError } from "@/lib/api";

// What to tell the user about a failed request. The backend's own message
// is written for users (e.g. "No NFT from this collection found in your
// wallet"), so it's shown as is.
export const errorMessage = (err: unknown) => {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return "Too many requests. Wait a minute and try again.";
    }
    if (err.status === 401) return "Your session expired. Sign in again.";
    if (err.status >= 500 && err.status !== 503) {
      return "Something went wrong on our side. Try again in a moment.";
    }
    return err.message;
  }
  // fetch() itself failed: offline, DNS, CORS, server down.
  if (err instanceof TypeError) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  // Wallet and contract errors (viem, wagmi) carry a one-line reason, e.g.
  // "insufficient funds" or "Chain not configured".
  const short = (err as { shortMessage?: unknown } | null)?.shortMessage;
  if (typeof short === "string" && short) return short;
  return "Something went wrong. Try again.";
};

export const notifyError = (err: unknown) => {
  // The toast is one line; the console keeps the whole story for debugging.
  console.error(err);
  toast.error(errorMessage(err));
};

export { toast };

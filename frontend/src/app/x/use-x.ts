import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useAuth } from "@/app/auth/use-auth";
import { API_URL, apiFetch } from "@/lib/api";
import { toast } from "@/lib/notify";

export type XAccount = {
  // Whether X linking is set up on the backend at all.
  available: boolean;
  // The linked handle (without @), or null.
  username: string | null;
};

export const useXAccount = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["x", address],
    queryFn: () => apiFetch<XAccount>("/me/x"),
    enabled: Boolean(address),
  });
};

// A full-page navigation, not a fetch: the backend redirects to X's consent
// page and X redirects back to /profile?x=<result>.
export const connectX = () => {
  window.location.assign(`${API_URL}/auth/x/start`);
};

const RESULTS: Record<
  string,
  [kind: "success" | "info" | "error", text: string]
> = {
  connected: ["success", "X account connected"],
  denied: ["info", "X connection cancelled"],
  taken: ["error", "This X account is already linked to another wallet"],
  "already-linked": [
    "error",
    "This wallet is already linked to a different X account",
  ],
  expired: ["error", "The X sign-in took too long. Try again."],
  unavailable: ["error", "Connecting X isn't available right now"],
  failed: ["error", "Couldn't connect X. Try again."],
};

// Shows the outcome of an X connection (?x=...) once, then drops the param.
export const useXLinkResult = () => {
  const [params, setParams] = useSearchParams();
  const shown = useRef(false);
  const result = params.get("x");

  useEffect(() => {
    if (!result || shown.current) return;
    shown.current = true;
    const [kind, text] = RESULTS[result] ?? RESULTS.failed;
    toast[kind](text);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("x");
        return next;
      },
      { replace: true },
    );
  }, [result, setParams]);
};

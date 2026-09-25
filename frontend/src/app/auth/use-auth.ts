import { useQuery } from "@tanstack/react-query";
import type { AuthenticationStatus } from "@rainbow-me/rainbowkit";
import { isAddressEqual, type Address } from "viem";
import { useAccount } from "wagmi";
import { apiFetch } from "@/lib/api";

export type SessionResponse = { address: Address | null };

export const sessionQueryKey = ["auth", "session"] as const;

// Signed in = the backend session belongs to the wallet that is connected
// right now. A session left over from another account doesn't count.
export const useAuth = () => {
  const { address, status: accountStatus } = useAccount();
  const session = useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => apiFetch<SessionResponse>("/auth/session"),
  });

  const sessionAddress = session.data?.address;
  // Only the silent reconnect on page load counts as loading. A connection
  // the user started must stay "unauthenticated": RainbowKit keeps the
  // modal open for the signature only if the status is unauthenticated when
  // the wallet connects, and it closes the modal whenever the status changes
  // to unauthenticated.
  const status: AuthenticationStatus =
    session.isPending || accountStatus === "reconnecting"
      ? "loading"
      : address && sessionAddress && isAddressEqual(address, sessionAddress)
        ? "authenticated"
        : "unauthenticated";

  return {
    status,
    address: status === "authenticated" ? address : undefined,
  };
};

import { useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { reconnect } from "wagmi/actions";
import {
  RainbowKitAuthenticationProvider,
  createAuthenticationAdapter,
} from "@rainbow-me/rainbowkit";
import { ink } from "viem/chains";
import { createSiweMessage } from "viem/siwe";
import { apiFetch } from "@/lib/api";
import { notifyError, toast } from "@/lib/notify";
import { clearStoredReferral, storedReferral } from "@/app/auth/referral";
import {
  sessionQueryKey,
  useAuth,
  type SessionResponse,
} from "@/app/auth/use-auth";

interface AuthProviderProps {
  children: ReactNode;
}

// How long the silent reconnect on page load may take before we give up.
const RECONNECT_TIMEOUT = 10_000;

// The silent reconnect on page load, to the last used wallet only (the
// WagmiProvider's own one is off). wagmi's would ask every wallet in the
// list and every installed extension for its accounts, one by one, and wait
// for all of them: one extension that never answers kept the button on
// "Connecting…" even with Rabby already connected.
// It has no timeout either: if the wallet itself never answers (an
// extension that hasn't woken up, a stale WalletConnect session), give up
// after a while so the button shows "Connect Wallet"; connecting from the
// modal wakes the wallet up. The backend session is kept, so the same
// wallet doesn't have to sign again.
const useReconnect = () => {
  const config = useConfig();
  const { status } = useAccount();

  useEffect(() => {
    const run = async () => {
      const recentId = await config.storage?.getItem("recentConnectorId");
      const connector = config.connectors.find((x) => x.id === recentId);
      // No connectors means all of them to wagmi, so skip it instead.
      if (connector) await reconnect(config, { connectors: [connector] });
    };
    void run();
  }, [config]);

  useEffect(() => {
    if (status !== "reconnecting") return;
    const timer = setTimeout(() => {
      config.setState((x) =>
        x.status === "reconnecting"
          ? {
              ...x,
              status: "disconnected",
              current: null,
              connections: new Map(),
            }
          : x,
      );
    }, RECONNECT_TIMEOUT);
    return () => clearTimeout(timer);
  }, [config, status]);
};

// Sign-In with Ethereum: RainbowKit asks for a signature right after the
// wallet connects, and signs out on disconnect or account switch.
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  useReconnect();

  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () =>
          (await apiFetch<{ nonce: string }>("/auth/nonce")).nonce,

        createMessage: ({ nonce, address }) =>
          createSiweMessage({
            domain: window.location.host,
            uri: window.location.origin,
            address,
            statement: "Sign in to InkQuests.",
            version: "1",
            // The backend only accepts Ink. The signature doesn't depend on
            // the wallet's current network, so a wallet still on another
            // chain can sign in and switch afterwards.
            chainId: ink.id,
            nonce,
          }),

        verify: async ({ message, signature }) => {
          try {
            const session = await apiFetch<SessionResponse>("/auth/verify", {
              method: "POST",
              body: JSON.stringify({
                message,
                signature,
                ref: storedReferral(),
              }),
            });
            // Used or not (an existing account ignores it), it's done.
            clearStoredReferral();
            queryClient.setQueryData(sessionQueryKey, session);
            toast.success("Signed in");
            return true;
          } catch (err) {
            // RainbowKit only says "retry"; the toast says why.
            notifyError(err);
            return false;
          }
        },

        signOut: async () => {
          queryClient.setQueryData<SessionResponse>(sessionQueryKey, {
            address: null,
          });
          await apiFetch("/auth/logout", { method: "POST" });
        },
      }),
    [queryClient],
  );

  return (
    <RainbowKitAuthenticationProvider adapter={adapter} status={status}>
      {children}
    </RainbowKitAuthenticationProvider>
  );
};

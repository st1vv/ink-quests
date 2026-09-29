import { useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

// Sign-In with Ethereum: RainbowKit asks for a signature right after the
// wallet connects, and signs out on disconnect or account switch.
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const queryClient = useQueryClient();
  const { status } = useAuth();

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

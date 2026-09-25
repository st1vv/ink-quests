import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/app/auth/use-auth";

// Wraps a click handler so a signed-out user gets the connect modal (or
// its sign-in step, when the wallet is already connected) instead.
export const useRequireAuth = () => {
  const { status } = useAuth();
  const { openConnectModal } = useConnectModal();

  return <Args extends unknown[]>(action: (...args: Args) => void) =>
    (...args: Args) => {
      if (status === "authenticated") action(...args);
      else openConnectModal?.();
    };
};

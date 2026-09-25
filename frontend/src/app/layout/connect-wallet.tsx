import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/shared/ui/button";
import { ChevronDownIcon, SwitchIcon, WalletIcon } from "@/shared/ui/icons";

export const ConnectWallet = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openConnectModal,
        openChainModal,
        openAccountModal,
      }) => {
        if (!mounted || authenticationStatus === "loading") {
          return (
            <Button disabled>
              <WalletIcon />
              Connect Wallet
            </Button>
          );
        }

        if (!account || !chain) {
          return (
            <Button onClick={openConnectModal}>
              <WalletIcon />
              Connect Wallet
            </Button>
          );
        }

        // Connected but the signature was dismissed or failed: the connect
        // modal reopens on its sign-in step.
        if (authenticationStatus === "unauthenticated") {
          return (
            <Button onClick={openConnectModal}>
              <WalletIcon />
              Sign in
            </Button>
          );
        }

        if (chain.unsupported) {
          return (
            <Button onClick={openChainModal}>
              <SwitchIcon />
              Switch to Ink
            </Button>
          );
        }

        return (
          <Button variant="ghost" onClick={openAccountModal}>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {account.displayName}
            <ChevronDownIcon className="h-4 w-4 text-white/50" />
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
};

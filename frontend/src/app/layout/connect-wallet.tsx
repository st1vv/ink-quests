import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/shared/ui/button";
import type { ButtonVariant } from "@/shared/ui/button-styles";
import {
  ChevronDownIcon,
  SpinnerIcon,
  SwitchIcon,
  WalletIcon,
} from "@/shared/ui/icons";

export const ConnectWallet = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        connectModalOpen,
        openConnectModal,
        openChainModal,
        openAccountModal,
      }) => {
        // The connect modal stays open through picking a wallet, approving
        // the connection and signing the SIWE message.
        if (
          !mounted ||
          authenticationStatus === "loading" ||
          connectModalOpen
        ) {
          return (
            <WalletButton disabled icon={<SpinnerIcon />}>
              Connecting…
            </WalletButton>
          );
        }

        if (!account || !chain) {
          return (
            <WalletButton onClick={openConnectModal} icon={<WalletIcon />}>
              Connect Wallet
            </WalletButton>
          );
        }

        // Connected but the signature was dismissed or failed: the connect
        // modal reopens on its sign-in step.
        if (authenticationStatus === "unauthenticated") {
          return (
            <WalletButton onClick={openConnectModal} icon={<WalletIcon />}>
              Sign in
            </WalletButton>
          );
        }

        if (chain.unsupported) {
          return (
            <WalletButton onClick={openChainModal} icon={<SwitchIcon />}>
              Switch to Ink
            </WalletButton>
          );
        }

        return (
          <WalletButton
            variant="ghost"
            onClick={openAccountModal}
            icon={
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            }
            trailing={<ChevronDownIcon className="h-4 w-4 text-white/50" />}
          >
            {account.displayName}
          </WalletButton>
        );
      }}
    </ConnectButton.Custom>
  );
};

type WalletButtonProps = {
  icon: ReactNode;
  trailing?: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

// One fixed width for every state, so the header doesn't shift when the
// label changes. Sized for "Connect Wallet" and a shortened address and
// still fits a 320px screen next to the logo; longer labels (ENS names)
// are truncated.
const WalletButton = ({
  icon,
  trailing,
  children,
  ...props
}: WalletButtonProps) => (
  <Button className="w-44" {...props}>
    {icon}
    <span className="min-w-0 truncate">{children}</span>
    {trailing}
  </Button>
);

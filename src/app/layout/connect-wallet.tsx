import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/shared/ui/button";

export const ConnectWallet = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openConnectModal,
        openChainModal,
        openAccountModal,
      }) => {
        if (!mounted) {
          return <Button disabled>Connect Wallet</Button>;
        }

        if (!account || !chain) {
          return <Button onClick={openConnectModal}>Connect Wallet</Button>;
        }

        if (chain.unsupported) {
          return <Button onClick={openChainModal}>Switch to Ink</Button>;
        }

        return (
          <Button variant="ghost" onClick={openAccountModal}>
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {account.displayName}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
};

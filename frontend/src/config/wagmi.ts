import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { ink } from "viem/chains";

const appName = "InkQuests";

// Get a free projectId at https://dashboard.reown.com and put it into .env.local
const projectId: string | undefined = import.meta.env
  .VITE_WALLETCONNECT_PROJECT_ID;

// Without a projectId RainbowKit throws on any WalletConnect-based wallet,
// so fall back to browser-extension wallets only. Installed EIP-6963 wallets
// (MetaMask, OKX...) are still discovered automatically.
// On mobile there are no extensions to discover, so the modal lists only
// these. Inside a wallet's in-app browser its own entry connects directly;
// in a regular mobile browser it opens the app over WalletConnect.
// injectedWallet catches any other in-app browser wallet.
const connectors = projectId
  ? connectorsForWallets(
      [
        {
          groupName: "Popular",
          wallets: [
            rabbyWallet,
            okxWallet,
            binanceWallet,
            metaMaskWallet,
            coinbaseWallet,
          ],
        },
        {
          groupName: "More",
          wallets: [
            trustWallet,
            rainbowWallet,
            walletConnectWallet,
            injectedWallet,
          ],
        },
      ],
      { appName, projectId },
    )
  : connectorsForWallets(
      [
        {
          groupName: "Installed",
          wallets: [injectedWallet, rabbyWallet, coinbaseWallet],
        },
      ],
      { appName, projectId: "" },
    );

if (!projectId) {
  console.warn(
    "VITE_WALLETCONNECT_PROJECT_ID is not set — WalletConnect (QR / mobile wallets) is disabled.",
  );
}

export const wagmiConfig = createConfig({
  connectors,
  chains: [ink],
  transports: {
    [ink.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

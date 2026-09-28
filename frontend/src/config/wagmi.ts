import { connectorsForWallets, getDefaultWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  rabbyWallet,
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
const connectors = projectId
  ? connectorsForWallets(getDefaultWallets().wallets, { appName, projectId })
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

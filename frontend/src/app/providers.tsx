import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster } from "sonner";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/config/wagmi";
import { AuthProvider } from "@/app/auth/auth-provider";
import { notifyError } from "@/lib/notify";

const queryClient = new QueryClient({
  // Every failed action (check-in, claim, …) shows its error as a toast.
  // Failed page loads keep their inline "Try again" states instead.
  mutationCache: new MutationCache({ onError: notifyError }),
});

const theme = darkTheme({
  accentColor: "#7132f5",
  accentColorForeground: "white",
  borderRadius: "large",
});

interface ProvidersProps {
  children: ReactNode;
}

export const Providers = ({ children }: ProvidersProps) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RainbowKitProvider theme={theme} modalSize="compact">
            {children}
            <Toaster
              theme="dark"
              richColors
              closeButton
              position="top-center"
              // Below the sticky 64px header, so it never covers the logo
              // or the wallet button.
              offset={{ top: 80 }}
              mobileOffset={{ top: 76 }}
              toastOptions={{ style: { fontFamily: "inherit" } }}
            />
          </RainbowKitProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

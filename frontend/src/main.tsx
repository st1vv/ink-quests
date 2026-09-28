import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "@/app/app";
import { Providers } from "@/app/providers";
import "@/styles/index.css";
import { captureReferralFromUrl } from "@/app/auth/referral";

// Before the router renders, so the ?ref= code is read before any redirect.
captureReferralFromUrl();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);

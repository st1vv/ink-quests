import type { ReactNode } from "react";

// The heading of the challenge page's cards.
export const CardTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-semibold tracking-tight text-white">
    {children}
  </h2>
);

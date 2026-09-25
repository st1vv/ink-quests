import type { ReactNode } from "react";
import { LayoutHeader, LayoutMobileNav } from "@/app/layout/header";
import { LayoutFooter } from "@/app/layout/footer";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    // Bottom padding on mobile keeps the footer clear of the fixed bottom nav.
    <div className="flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] text-white md:pb-0">
      <LayoutHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>

      <LayoutFooter />
      <LayoutMobileNav />
    </div>
  );
};

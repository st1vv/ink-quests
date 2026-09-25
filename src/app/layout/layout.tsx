import type { ReactNode } from "react";
import { LayoutHeader } from "@/app/layout/header";
import { LayoutFooter } from "@/app/layout/footer";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col text-white">
      <LayoutHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>

      <LayoutFooter />
    </div>
  );
};

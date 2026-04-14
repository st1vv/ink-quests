import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  className: string;
}

export const Badge = ({ children, className = "" }: BadgeProps) => {
  return (
    <div
      className={`text-nowrap inline-flex rounded-full border border-[#7132f5]/30 bg-[#7132f5]/10 text-sm font-medium text-[#a884ff] ${className}`}
    >
      {children}
    </div>
  );
};

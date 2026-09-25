import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export const Badge = ({ children, className = "" }: BadgeProps) => {
  return (
    <div
      className={`inline-flex text-nowrap rounded-full border border-ink/30 bg-ink/10 text-sm font-medium text-ink-light ${className}`}
    >
      {children}
    </div>
  );
};

import type { ReactNode } from "react";
import { badgeColors, type BadgeVariant } from "@/shared/ui/badge-colors";

interface BadgeProps {
  children: ReactNode;
  className?: string;
  // "ink" for highlights like XP; the rest for labels like partner tags.
  variant?: BadgeVariant;
}

export const Badge = ({
  children,
  className = "",
  variant = "ink",
}: BadgeProps) => {
  return (
    <div
      className={`inline-flex text-nowrap rounded-full border text-sm font-medium ${badgeColors(variant)} ${className}`}
    >
      {children}
    </div>
  );
};

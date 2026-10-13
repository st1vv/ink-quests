import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  className?: string;
  // "ink" for highlights like XP; the rest for labels like partner tags.
  variant?: BadgeVariant;
}

const VARIANTS = {
  ink: "border-ink/30 bg-ink/10 text-ink-light",
  neutral: "border-white/15 bg-white/5 text-white/70",
  pink: "border-pink-400/30 bg-pink-400/10 text-pink-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  orange: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  teal: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  blue: "border-blue-500/40 bg-blue-500/15 text-blue-400",
};

export type BadgeVariant = keyof typeof VARIANTS;

export const Badge = ({
  children,
  className = "",
  variant = "ink",
}: BadgeProps) => {
  return (
    <div
      className={`inline-flex text-nowrap rounded-full border text-sm font-medium ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </div>
  );
};

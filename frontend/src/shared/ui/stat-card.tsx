import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}

export const StatCard = ({ label, value, hint, children }: StatCardProps) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
      {children}
    </div>
  );
};

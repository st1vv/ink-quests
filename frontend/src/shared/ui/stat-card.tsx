import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  // Makes the card a button, e.g. to pick what a table below shows.
  onClick?: () => void;
  selected?: boolean;
}

export const StatCard = ({
  label,
  value,
  hint,
  children,
  onClick,
  selected = false,
}: StatCardProps) => {
  const content = (
    <>
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
      {children}
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`cursor-pointer rounded-3xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-ink-light ${
        selected
          ? "border-ink/60 bg-ink/15"
          : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.04]"
      }`}
    >
      {content}
    </button>
  );
};

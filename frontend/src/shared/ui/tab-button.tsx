type TabButtonProps = {
  selected: boolean;
  onClick: () => void;
  label: string;
  count?: number;
};

// One tab of a pill-shaped tab list (role="tablist" on the wrapper).
export const TabButton = ({
  selected,
  onClick,
  label,
  count,
}: TabButtonProps) => (
  <button
    type="button"
    role="tab"
    aria-selected={selected}
    onClick={onClick}
    className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-ink-light ${
      selected
        ? "bg-ink text-white"
        : "text-white/60 hover:bg-white/5 hover:text-white"
    }`}
  >
    {label}
    {count !== undefined && (
      <span
        className={`rounded-full px-1.5 text-xs tabular-nums ${
          selected ? "bg-white/20" : "bg-white/10"
        }`}
      >
        {count}
      </span>
    )}
  </button>
);

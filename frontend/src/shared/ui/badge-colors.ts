// Badge colors (border, background, text), shared with things styled like a
// badge, e.g. filter chips.
const VARIANTS = {
  ink: "border-ink/30 bg-ink/10 text-ink-light",
  neutral: "border-white/15 bg-white/5 text-white/70",
  pink: "border-pink-400/30 bg-pink-400/10 text-pink-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  orange: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  teal: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  lime: "border-lime-400/30 bg-lime-400/10 text-lime-300",
  blue: "border-blue-500/40 bg-blue-500/15 text-blue-400",
};

export type BadgeVariant = keyof typeof VARIANTS;

export const badgeColors = (variant: BadgeVariant) => VARIANTS[variant];

export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-light disabled:pointer-events-none disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "border border-ink/20 bg-ink text-white hover:brightness-110",
  secondary: "border border-white/10 bg-white text-black hover:bg-white/90",
  ghost: "border border-white/10 bg-transparent text-white hover:bg-white/10",
};

// Lets links (react-router <Link>, <a>) look exactly like <Button>.
export const buttonStyles = ({
  variant = "primary",
  className = "",
}: { variant?: ButtonVariant; className?: string } = {}) =>
  `${base} ${variants[variant]} ${className}`;

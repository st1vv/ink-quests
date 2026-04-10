import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: Variant;
}

export const Button = ({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) => {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition cursor-pointer";

  const variants: Record<Variant, string> = {
    primary:
      "bg-[#7132f5] text-white border border-[#7132f5]/20 hover:opacity-90",
    secondary: "bg-white text-black border border-white/10 hover:bg-white/90",
    ghost: "bg-transparent text-white border border-white/10 hover:bg-white/10",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

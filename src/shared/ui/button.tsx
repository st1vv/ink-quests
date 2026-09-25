import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { buttonStyles, type ButtonVariant } from "@/shared/ui/button-styles";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: ButtonVariant;
}

export const Button = ({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, className })}
      {...props}
    >
      {children}
    </button>
  );
};

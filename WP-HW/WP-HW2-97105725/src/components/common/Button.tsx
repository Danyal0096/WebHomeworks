import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  children,
  className = "",
  variant = "secondary",
  size = "md",
  type = "button",
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button type={type} className={`button button-${variant} button-${size} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

import type { ReactNode } from "react";

interface SurfaceProps {
  children: ReactNode;
  className: string;
}

export const Surface = ({ children, className = "" }: SurfaceProps) => {
  return (
    <div
      className={`
        relative w-full max-w-3xl overflow-hidden
        rounded-[32px]
        border border-white/10
        bg-white/5
        p-5 shadow-2xl
        backdrop-blur
        md:p-8
        ${className}
      `}
    >
      {children}
    </div>
  );
};

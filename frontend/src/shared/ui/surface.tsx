import type { ReactNode } from "react";

interface SurfaceProps {
  children: ReactNode;
  className?: string;
}

export const Surface = ({ children, className = "" }: SurfaceProps) => {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-8 ${className}`}
    >
      {children}
    </div>
  );
};

import type { ReactNode } from "react";

interface SurfaceProps {
  children: ReactNode;
  className?: string;
}

// No backdrop-blur: cards sit on the flat page background, so it blurred
// nothing, and in Chrome it drew a stray horizontal seam across the card
// whenever the header repainted (e.g. hovering a nav link).
export const Surface = ({ children, className = "" }: SurfaceProps) => {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 md:p-8 ${className}`}
    >
      {children}
    </div>
  );
};

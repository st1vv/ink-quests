// A pulsing stand-in for something still loading. Give it the size and look
// of what it stands for, so nothing jumps once the data is in. A span, so it
// also fits inside text.
export const Skeleton = ({ className = "" }: { className?: string }) => (
  <span aria-hidden className={`block animate-pulse ${className}`} />
);

// A stand-in for a whole card (a Surface); give it the card's height.
export const CardSkeleton = ({ className = "" }: { className?: string }) => (
  <Skeleton
    className={`rounded-[32px] border border-white/10 bg-white/5 ${className}`}
  />
);

// A stand-in for a short value in a line of text, e.g. a stat card's number.
export const ValueSkeleton = ({
  className = "w-16",
}: {
  className?: string;
}) => (
  <Skeleton
    className={`inline-block h-[1em] rounded-full bg-white/10 align-middle ${className}`}
  />
);

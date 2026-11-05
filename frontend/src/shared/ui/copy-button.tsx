import { CheckIcon, CopyIcon } from "@/shared/ui/icons";
import { useCopy } from "@/shared/ui/use-copy";

// The copy icon, or a check for a moment after a copy (see useCopy).
export const CopyIconSwap = ({
  copied,
  className = "h-4 w-4",
}: {
  copied: boolean;
  className?: string;
}) =>
  copied ? (
    <CheckIcon className={`${className} text-emerald-300`} />
  ) : (
    <CopyIcon className={className} />
  );

// A round icon button next to the thing it copies.
export const CopyButton = ({
  text,
  label,
}: {
  text: string;
  label: string;
}) => {
  const { copied, copy } = useCopy(text, label);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-ink-light"
    >
      <CopyIconSwap copied={copied} />
    </button>
  );
};

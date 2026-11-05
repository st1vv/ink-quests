import { useState } from "react";
import { toast } from "@/lib/notify";

// Copies `text` and toasts the outcome; `copied` is true for a moment after.
// `label` names what was copied, e.g. "address".
export const useCopy = (text: string, label: string) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Copied ${label}`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context or no permission).
      toast.error(`Couldn't copy the ${label}`);
    }
  };

  return { copied, copy };
};

import { Link } from "react-router";
import { XLogoIcon } from "@/shared/ui/icons";

const X_URL = "https://x.com/inkquests";

export const LayoutFooter = () => {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-white/50 sm:flex-row">
        <span>© {new Date().getFullYear()} InkQuests</span>

        <div className="flex items-center gap-3">
          <Link to="/faq" className="transition hover:text-white">
            FAQ
          </Link>
          <span aria-hidden className="text-white/20">
            ·
          </span>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="InkQuests on X"
            title="InkQuests on X"
            className="inline-flex items-center transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-light"
          >
            <XLogoIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
};

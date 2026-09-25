const FOOTER_LINKS = [
  { id: "github", label: "GitHub", href: "https://github.com/st1vv/ink-quests" },
  { id: "x", label: "X", href: "https://x.com/stanislav1w" },
];

export const LayoutFooter = () => {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-white/50 sm:flex-row">
        <span>© {new Date().getFullYear()} InkQuest · Built on Ink</span>

        <div className="flex items-center gap-4">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

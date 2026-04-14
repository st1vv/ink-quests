export const LayoutFooter = () => {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-white/60 sm:flex-row">
        <span>© {new Date().getFullYear()} InkQuest</span>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/st1vv/ink-quests"
            className="hover:text-white transition"
            target="_blank"
          >
            GitHub
          </a>
          <a
            href="https://x.com/stanislav1w"
            className="hover:text-white transition"
            target="_blank"
          >
            X
          </a>
        </div>
      </div>
    </footer>
  );
};

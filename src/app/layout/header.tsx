import { Link } from "react-router";
import { Button } from "@/shared/ui/button";

export const LayoutHeader = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0f]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-white"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#7132f5]" />
          Ink Daily Quests
        </Link>

        <nav className="hidden items-center gap-1 rounded-full p-1 md:flex">
          <HeaderLink to="/" label="Home" />
          <HeaderLink to="/quests" label="Quests" />
          <HeaderLink to="/leaderboard" label="Leaderboard" />
          <HeaderLink to="/faq" label="FAQ" />
        </nav>

        <Button>Connect Wallet</Button>
      </div>
    </header>
  );
};

type HeaderLinkProps = {
  to: string;
  label: string;
};

const HeaderLink = ({ to, label }: HeaderLinkProps) => {
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
};

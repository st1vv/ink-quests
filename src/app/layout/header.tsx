import { Link, useLocation } from "react-router";
import { Button } from "@/shared/ui/button";

const NAVIGATION_ITEMS = [
  {
    id: "home",
    label: "Home",
    link: "/",
  },
  {
    id: "quests",
    label: "Quests",
    link: "/quests",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    link: "/leaderboard",
  },
  {
    id: "faq",
    label: "FAQ",
    link: "/faq",
  },
];

export const LayoutHeader = () => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0f]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-white"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#7132f5]" />
          Ink Daily Quests
        </Link>

        <nav className="hidden items-center gap-1 rounded-full p-1 md:flex">
          {NAVIGATION_ITEMS.map((item) => (
            <HeaderLink
              key={item.id}
              to={item.link}
              label={item.label}
              isActive={item.link === location.pathname}
            />
          ))}
        </nav>

        <Button>Connect Wallet</Button>
      </div>
    </header>
  );
};

type HeaderLinkProps = {
  to: string;
  label: string;
  isActive: boolean;
};

const HeaderLink = ({ to, label, isActive }: HeaderLinkProps) => {
  return (
    <Link
      to={to}
      className={`rounded-full px-4 py-2 text-sm font-medium transition hover:bg-white/10 ${isActive ? "text-white" : "text-white/70"}`}
    >
      {label}
    </Link>
  );
};

import { Link, NavLink } from "react-router";
import { ConnectWallet } from "@/app/layout/connect-wallet";

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
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-canvas/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-white"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink shadow-[0_0_12px_2px] shadow-ink/60" />
          InkQuest
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAVIGATION_ITEMS.map((item) => (
            <HeaderLink key={item.id} to={item.link} label={item.label} />
          ))}
        </nav>

        <ConnectWallet />
      </div>

      <nav className="mx-4 mb-3 flex gap-1 md:hidden">
        {NAVIGATION_ITEMS.map((item) => (
          <HeaderLink
            key={item.id}
            to={item.link}
            label={item.label}
            className="flex-auto px-3 text-center"
          />
        ))}
      </nav>
    </header>
  );
};

type HeaderLinkProps = {
  to: string;
  label: string;
  className?: string;
};

const HeaderLink = ({ to, label, className = "px-4" }: HeaderLinkProps) => {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `rounded-full py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-ink-light ${className} ${
          isActive
            ? "bg-white/10 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      {label}
    </NavLink>
  );
};

import type { ComponentType } from "react";
import { Link, NavLink } from "react-router";
import { ConnectWallet } from "@/app/layout/connect-wallet";
import {
  HelpIcon,
  HomeIcon,
  QuestsIcon,
  TrophyIcon,
  type IconProps,
} from "@/shared/ui/icons";

const NAVIGATION_ITEMS = [
  {
    id: "home",
    label: "Home",
    link: "/",
    icon: HomeIcon,
  },
  {
    id: "quests",
    label: "Quests",
    link: "/quests",
    icon: QuestsIcon,
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    link: "/leaderboard",
    icon: TrophyIcon,
  },
  {
    id: "faq",
    label: "FAQ",
    link: "/faq",
    icon: HelpIcon,
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
            <HeaderLink
              key={item.id}
              to={item.link}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </nav>

        <ConnectWallet />
      </div>
    </header>
  );
};

// Rendered outside <header>: its backdrop-blur would become the containing
// block for this fixed element and pin it to the header instead of the viewport.
export const LayoutMobileNav = () => {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 min-w-80 border-t border-white/10 bg-canvas/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-stretch gap-1 px-2 py-1.5">
        {NAVIGATION_ITEMS.map((item) => (
          <HeaderLink
            key={item.id}
            to={item.link}
            label={item.label}
            icon={item.icon}
            className="min-w-0 flex-1 flex-col justify-center gap-1 rounded-xl px-1 text-xs"
          />
        ))}
      </div>
    </nav>
  );
};

type HeaderLinkProps = {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  className?: string;
};

const HeaderLink = ({
  to,
  label,
  icon: IconComponent,
  className = "gap-2 rounded-full px-4 py-2 text-sm",
}: HeaderLinkProps) => {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `inline-flex items-center font-medium transition focus-visible:outline-2 focus-visible:outline-ink-light ${className} ${
          isActive
            ? "bg-ink text-white shadow-lg shadow-ink/25"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      <IconComponent />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  );
};

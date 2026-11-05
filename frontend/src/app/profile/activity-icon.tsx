import type { ReactNode } from "react";
import {
  CheckIcon,
  FlameIcon,
  GiftIcon,
  QuestsIcon,
  UsersIcon,
} from "@/shared/ui/icons";
import type { Activity } from "@/app/profile/use-profile";

const ICONS: Record<Activity["type"], { icon: ReactNode; style: string }> = {
  "check-in": { icon: <FlameIcon />, style: "bg-ink/20" },
  quest: { icon: <CheckIcon />, style: "bg-emerald-400/15 text-emerald-300" },
  referral: { icon: <UsersIcon />, style: "bg-sky-400/15 text-sky-300" },
  // The sword is also the Quests icon in the nav.
  campaign: { icon: <QuestsIcon />, style: "bg-amber-400/15 text-amber-300" },
  bonus: { icon: <GiftIcon />, style: "bg-fuchsia-400/15 text-fuchsia-300" },
};

// The round icon at the start of an activity row, in the profile and on
// the admin user page.
export const ActivityIcon = ({ type }: { type: Activity["type"] }) => {
  const { icon, style } = ICONS[type];
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${style}`}
    >
      {icon}
    </span>
  );
};

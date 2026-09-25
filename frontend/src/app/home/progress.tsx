import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/surface";
import { StatCard } from "@/shared/ui/stat-card";
import { formatNumber } from "@/lib/format";

export const HomeProgress = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const user = {
    totalXP: 1240,
    streak: 5,
    level: 3,
    nextLevelXP: 1500,
  };

  const levelProgress = Math.min(user.totalXP / user.nextLevelXP, 1) * 100;

  const handleCheckIn = () => {
    setIsCheckedIn(true);
  };

  return (
    <Surface className="h-full">
      <div className="flex h-full flex-col gap-4">
        <div className="flex min-h-9 items-center">
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Your progress
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Daily streak" value={`🔥 ${user.streak} days`} />
          <StatCard label="Level" value={user.level} />

          <div className="col-span-2">
            <StatCard
              label="Total XP"
              value={`${formatNumber(user.totalXP)} XP`}
            >
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-r from-ink to-ink-light"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-white/40">
                {formatNumber(user.nextLevelXP - user.totalXP)} XP to level{" "}
                {user.level + 1}
              </p>
            </StatCard>
          </div>
        </div>

        <div className="mt-auto pt-2">
          {isCheckedIn ? (
            <Button variant="ghost" disabled className="w-full">
              ✓ Checked in today
            </Button>
          ) : (
            <Button onClick={handleCheckIn} className="w-full">
              Daily Check-in
            </Button>
          )}
        </div>
      </div>
    </Surface>
  );
};

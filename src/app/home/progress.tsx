import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/surface";

export const HomeProgress = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const user = {
    name: "Stanislav",
    totalXP: 1240,
    streak: 5,
    level: 3,
  };

  const handleCheckIn = () => {
    setIsCheckedIn(true);
  };

  return (
    <Surface className="w-full max-w-full h-full">
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Your progress
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <ProgressCard label="Daily streak" value={`${user.streak} days`} />
            <ProgressCard label="Level" value={`${user.level}`} />

            <div className="col-span-2">
              <ProgressCard label="Total XP" value={`${user.totalXP} XP`} />
            </div>
          </div>
        </div>

        <div className="pt-2">
          {isCheckedIn ? (
            <Button
              variant="ghost"
              disabled
              className="w-full cursor-not-allowed opacity-60"
            >
              Checked in today
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

type ProgressCardProps = {
  label: string;
  value: string;
};

const ProgressCard = ({ label, value }: ProgressCardProps) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
};

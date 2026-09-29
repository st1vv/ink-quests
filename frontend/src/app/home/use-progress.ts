import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { ApiError, apiFetch } from "@/lib/api";
import { toast } from "@/lib/notify";

type CheckInResult = { day: string; points: number; bonusPoints: number };

export type Progress = {
  totalXp: number;
  level: number;
  // Total XP at which the current and the next level start.
  levelXp: number;
  nextLevelXp: number;
  streak: number;
  checkedInToday: boolean;
  // Monday to Sunday of the current UTC week: true where checked in.
  week: boolean[];
  checkInXp: number;
  // Extra XP for checking in every day of a Monday-Sunday week.
  fullWeekBonusXp: number;
};

const msUntilNextUtcDay = () => {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - Date.now();
};

export const useProgress = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["progress", address],
    queryFn: () => apiFetch<Progress>("/me/progress"),
    enabled: Boolean(address),
    // Refetch right after 00:00 UTC so the check-in button comes back on a
    // page left open overnight.
    refetchInterval: () => msUntilNextUtcDay() + 1000,
  });
};

export const useCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await apiFetch<CheckInResult>("/me/check-in", {
          method: "POST",
        });
      } catch (err) {
        // Checked in from another tab: the refetch below shows it.
        if (err instanceof ApiError && err.status === 409) return null;
        throw err;
      }
    },
    onSuccess: (result) => {
      if (!result) toast.info("Already checked in today");
      else if (result.bonusPoints > 0) {
        toast.success(
          `Checked in · +${result.points + result.bonusPoints} XP`,
          {
            description: `Includes +${result.bonusPoints} XP for a full week of check-ins 🔥`,
          },
        );
      } else toast.success(`Checked in · +${result.points} XP`);

      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        queryClient.invalidateQueries({ queryKey: ["rank"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
    },
  });
};

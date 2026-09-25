import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { ApiError, apiFetch } from "@/lib/api";

export type Progress = {
  totalXp: number;
  level: number;
  // Total XP at which the current and the next level start.
  levelXp: number;
  nextLevelXp: number;
  streak: number;
  checkedInToday: boolean;
};

// Shown on the button; the backend decides the actual reward.
export const CHECK_IN_XP = 20;

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
        await apiFetch("/me/check-in", { method: "POST" });
      } catch (err) {
        // Checked in from another tab: the refetch below shows it.
        if (!(err instanceof ApiError && err.status === 409)) throw err;
      }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        queryClient.invalidateQueries({ queryKey: ["rank"] }),
      ]),
  });
};

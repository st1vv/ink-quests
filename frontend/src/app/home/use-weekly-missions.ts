import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/notify";

// One of the week's missions. Progress counts what the user already does
// (check-ins, daily quests, referrals…) during the current UTC week,
// Monday to Sunday; capped at the target.
export type WeeklyMission = {
  slug: string;
  title: string;
  description: string;
  target: number;
  points: number;
  progress: number;
  claimed: boolean;
};

export type WeeklyMissions = {
  // The week's Monday, YYYY-MM-DD.
  week: string;
  // Next Monday 00:00 UTC, when the next week's missions start.
  resetsAt: string;
  missions: WeeklyMission[];
};

// Signed out, the week's missions come without progress.
export const useWeeklyMissions = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["weekly-missions", address],
    queryFn: () =>
      apiFetch<WeeklyMissions>(
        address ? "/me/weekly-missions" : "/weekly-missions",
      ),
    // A new week brings new missions.
    refetchInterval: (query) => {
      const resetsAt = query.state.data?.resetsAt;
      return resetsAt
        ? Math.max(1000, Date.parse(resetsAt) - Date.now() + 1000)
        : false;
    },
  });
};

export const useClaimWeeklyMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      apiFetch<{ slug: string; title: string; points: number }>(
        `/me/weekly-missions/${slug}/claim`,
        { method: "POST" },
      ),
    onSuccess: (result) => {
      toast.success(`Mission complete: +${result.points} XP`, {
        description: result.title,
      });
      // The mission, and the XP everywhere it shows.
      return Promise.all(
        [
          "weekly-missions",
          "progress",
          "leaderboard",
          "rank",
          "stats",
          "activity",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
};

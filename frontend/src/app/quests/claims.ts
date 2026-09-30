import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { ApiError, apiFetch } from "@/lib/api";
import { toast } from "@/lib/notify";

type CompletionsResponse = { questIds: number[] };

export type ClaimResult = { questId: number; points: number; txHash: string };

// YYYY-MM-DD of the current UTC day; daily quests reset when it changes.
export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

// Ids of quests the signed-in user has already completed for the current
// period. The day is part of the key, so a re-render after 00:00 UTC
// fetches the fresh (empty) list for the new day.
export const useCompletions = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["completions", address, utcDay()],
    queryFn: () => apiFetch<CompletionsResponse>("/me/completions"),
    enabled: Boolean(address),
    select: (data) => new Set(data.questIds),
  });
};

export const useClaimQuest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questId }: { questId: number; title: string }) => {
      try {
        return await apiFetch<ClaimResult>(`/quests/${questId}/claim`, {
          method: "POST",
        });
      } catch (err) {
        // Claimed in another tab: nothing went wrong from the user's side.
        if (err instanceof ApiError && err.status === 409) return null;
        throw err;
      }
    },
    onSuccess: (result, { title }) => {
      if (result && result.points > 0) {
        toast.success(`+${result.points} XP`, { description: title });
      } else if (result) toast.success("Task verified", { description: title });
      else toast.info(`${title}: already claimed today`);

      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["completions"] }),
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        queryClient.invalidateQueries({ queryKey: ["rank"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
    },
  });
};

// Campaigns whose reward the signed-in user has claimed.
export const useClaimedCampaigns = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["campaigns", address],
    queryFn: () => apiFetch<{ claimed: string[] }>("/me/campaigns"),
    enabled: Boolean(address),
    select: (data) => new Set(data.claimed),
  });
};

// A campaign's XP, once all of its tasks are verified.
export const useClaimCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug }: { slug: string; title: string }) =>
      apiFetch<{ points: number }>(`/partners/${slug}/claim`, {
        method: "POST",
      }),
    onSuccess: (result, { title }) => {
      toast.success(`+${result.points} XP`, {
        description: `${title} quest completed 🎉`,
      });
      return Promise.all(
        ["campaigns", "progress", "leaderboard", "rank", "activity"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
};

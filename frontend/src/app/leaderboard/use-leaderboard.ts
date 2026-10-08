import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAuth } from "@/app/auth/use-auth";
import { apiFetch } from "@/lib/api";

export type LeaderboardEntry = {
  rank: number;
  address: Address;
  // Shown instead of the address when set.
  name: string | null;
  xp: number;
  level: number;
};

export type MyRank = {
  // Null until the user has any XP.
  rank: number | null;
  name: string | null;
  xp: number;
  // XP needed to pass the closest user above; null when already first.
  xpToNextRank: number | null;
};

export const useLeaderboard = () =>
  useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch<LeaderboardEntry[]>("/leaderboard"),
    staleTime: 30 * 1000,
  });

export const useMyRank = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["rank", address],
    queryFn: () => apiFetch<MyRank>("/me/rank"),
    enabled: Boolean(address),
  });
};

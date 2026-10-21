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

export type Challenge = {
  slug: string;
  title: string;
  startsAt: string;
  // Exclusive: activity from this moment on doesn't count.
  endsAt: string;
  // Running now, finished (the last one), or the next one to start.
  status: "live" | "ended" | "upcoming";
  // The top `places` win `prize`.
  places: number;
  prize: string;
  // The announcement on X.
  postUrl: string | null;
  // Most referral rewards one player can count in the challenge.
  referralLimit: number;
  // Whether taking part needs a linked X account.
  xRequired: boolean;
};

export type ChallengeEntry = {
  rank: number;
  address: Address;
  name: string | null;
  score: number;
};

export type ChallengeOverview = {
  // Null when no challenge has been set up.
  challenge: Challenge | null;
  top: ChallengeEntry[];
};

export type MyChallenge = {
  // Null until the player scores, or while they can't take part.
  rank: number | null;
  name: string | null;
  score: number;
  // False when the challenge needs a linked X account and they have none.
  eligible: boolean;
  xLinked: boolean;
  // Referral rewards counted so far, up to the challenge's referralLimit.
  referralsCounted: number;
};

export const useChallenge = () =>
  useQuery({
    queryKey: ["challenge"],
    queryFn: () => apiFetch<ChallengeOverview>("/challenge"),
    staleTime: 30 * 1000,
  });

// Null when there's no challenge.
export const useMyChallenge = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["challenge", "me", address],
    queryFn: () => apiFetch<MyChallenge | null>("/me/challenge"),
    enabled: Boolean(address),
  });
};

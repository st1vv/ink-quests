import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { apiFetch } from "@/lib/api";

export type ProfileStats = {
  joinedAt: string;
  questsCompleted: number;
};

export type Activity = {
  type: "check-in" | "quest" | "referral" | "campaign";
  // Quest or campaign title, the invited friend's address for referrals,
  // null for check-ins.
  title: string | null;
  points: number;
  // Full-week bonus paid with a Sunday check-in.
  bonusPoints: number;
  at: string;
  txHash: string | null;
};

export const useProfileStats = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["stats", address],
    queryFn: () => apiFetch<ProfileStats>("/me/stats"),
    enabled: Boolean(address),
  });
};

export const useActivity = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["activity", address],
    queryFn: () => apiFetch<Activity[]>("/me/activity"),
    enabled: Boolean(address),
  });
};

export type Referrals = {
  code: string;
  // Signed up with the user's link.
  invited: number;
  // Also completed an onchain quest, which paid the reward.
  rewarded: number;
  xpEarned: number;
  rewardXp: number;
};

export const useReferrals = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["referrals", address],
    queryFn: () => apiFetch<Referrals>("/me/referrals"),
    enabled: Boolean(address),
  });
};

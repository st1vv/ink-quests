import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { apiFetch } from "@/lib/api";

export type ProfileStats = {
  joinedAt: string;
  checkIns: number;
  questsCompleted: number;
  bestStreak: number;
};

export type Activity = {
  type: "check-in" | "quest";
  // Quest title; null for check-ins.
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

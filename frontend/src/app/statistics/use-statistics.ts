import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAuth } from "@/app/auth/use-auth";
import { ApiError, apiFetch } from "@/lib/api";

export type StatsSummary = {
  users: number;
  usersWithXp: number;
  questsCompleted: number;
  dailyQuestsCompleted: number;
  // Campaigns with every task done; single tasks don't count.
  partnerQuestsCompleted: number;
  checkIns: number;
  // Quest completions proven by an onchain transaction.
  transactions: number;
  // Wallets with at least one of those.
  transactionUsers: number;
};

export type StatsTransaction = {
  id: number;
  address: Address;
  quest: string;
  kind: "daily" | "partner";
  // Campaign title for partner quests.
  partner: string | null;
  points: number;
  txHash: string;
  completedAt: string;
};

export type StatsTransactions = {
  total: number;
  page: number;
  pageSize: number;
  items: StatsTransaction[];
};

// The backend answers 404 to wallets that aren't admins; retrying won't help.
const retryUnlessNotFound = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status === 404) && failureCount < 3;

export const isNotFound = (error: Error | null) =>
  error instanceof ApiError && error.status === 404;

export const useStatsSummary = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["statistics", "stats", address],
    queryFn: () => apiFetch<StatsSummary>("/statistics"),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
  });
};

export const useStatsTransactions = (page: number, filter: string | null) => {
  const { address } = useAuth();
  const params = new URLSearchParams({ page: String(page) });
  if (filter) params.set("address", filter);

  return useQuery({
    queryKey: ["statistics", "transactions", address, page, filter],
    queryFn: () =>
      apiFetch<StatsTransactions>(`/statistics/transactions?${params}`),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
};

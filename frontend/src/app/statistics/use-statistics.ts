import { useQuery } from "@tanstack/react-query";
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

// The lists behind the stat cards, one per card (GET /statistics/:view).
export type StatsView =
  | "users"
  | "users-with-xp"
  | "quests"
  | "daily-quests"
  | "partner-quests"
  | "check-ins"
  | "transactions"
  | "transaction-wallets";

export type StatsUser = {
  id: number;
  address: Address;
  name: string | null;
  xp: number;
  level: number;
  createdAt: string;
  lastLoginAt: string | null;
  // Who invited them.
  referrer: Address | null;
  referrerName: string | null;
  // Users they invited, and how many of those did an onchain quest (which
  // pays the referral reward).
  referrals: number;
  rewardedReferrals: number;
  // The linked X handle, without the @; null when not linked.
  xUsername: string | null;
};

export type StatsRankedUser = {
  id: number;
  // Overall place, our own wallets included.
  rank: number;
  address: Address;
  name: string | null;
  xp: number;
  level: number;
  lastXpAt: string;
};

// A daily quest completion, a finished partner quest, or (in the
// transactions list) any completion proven onchain.
export type StatsCompletion = {
  id: string;
  address: Address;
  name: string | null;
  // Quest title; the partner's title for a finished partner quest.
  quest: string;
  kind: "daily" | "partner";
  // Campaign title for a partner task.
  partner: string | null;
  points: number;
  txHash: string | null;
  completedAt: string;
};

export type StatsCheckIn = {
  id: number;
  address: Address;
  name: string | null;
  // UTC day, YYYY-MM-DD.
  day: string;
  points: number;
  bonusPoints: number;
  createdAt: string;
};

export type StatsTransactionWallet = {
  id: number;
  address: Address;
  name: string | null;
  transactions: number;
  // XP from those transactions.
  xp: number;
  lastTxAt: string;
};

export type StatsPage<T> = {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
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

// The caller picks T to match the view.
export const useStatsList = <T>(
  view: StatsView,
  page: number,
  filter: string | null,
) => {
  const { address } = useAuth();
  const params = new URLSearchParams({ page: String(page) });
  if (filter) params.set("address", filter);

  return useQuery({
    queryKey: ["statistics", view, address, page, filter],
    queryFn: () => apiFetch<StatsPage<T>>(`/statistics/${view}?${params}`),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
    // Keeps the current page on screen while the next one of the same list
    // loads; another list's rows have other fields, so not across lists.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === view ? previous : undefined,
  });
};

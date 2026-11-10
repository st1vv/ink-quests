import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAuth } from "@/app/auth/use-auth";
import type { Activity } from "@/app/profile/use-profile";
import { ApiError, apiFetch } from "@/lib/api";
import { shortAddress } from "@/lib/format";
import { toast } from "@/lib/notify";

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

// The lists behind the stat cards, one per card (GET /admin/stats/:view).
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
  // Users they invited, and how many of those paid a referral reward.
  referrals: number;
  rewardedReferrals: number;
  // The linked X handle, without the @; null when not linked.
  xUsername: string | null;
};

// A daily quest completion, a finished partner quest, or (in the
// transactions list) any completion proven onchain.
export type StatsCompletion = {
  id: string;
  address: Address;
  name: string | null;
  // The linked X handle, without the @; null when not linked.
  xUsername: string | null;
  // Quest title; the partner's title for a finished partner quest.
  quest: string;
  // "check-in" only in the transactions list: a paid check-in.
  kind: "daily" | "partner" | "check-in";
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
  // The linked X handle, without the @; null when not linked.
  xUsername: string | null;
  // UTC day, YYYY-MM-DD.
  day: string;
  points: number;
  bonusPoints: number;
  createdAt: string;
  // The paid check-in's transaction; null for free ones.
  txHash: string | null;
};

export type StatsTransactionWallet = {
  id: number;
  address: Address;
  name: string | null;
  // The linked X handle, without the @; null when not linked.
  xUsername: string | null;
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

// One row of a user's activity on the admin user page: the profile's
// activity plus campaign tasks (quests worth 0 XP that name their partner).
export type UserActivity = Activity & { partner: string | null };

// The backend answers 404 to wallets that aren't admins; retrying won't help.
const retryUnlessNotFound = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status === 404) && failureCount < 3;

export const isNotFound = (error: Error | null) =>
  error instanceof ApiError && error.status === 404;

export const useStatsSummary = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["admin", "stats", address],
    queryFn: () => apiFetch<StatsSummary>("/admin/stats"),
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
    queryKey: ["admin", view, address, page, filter],
    queryFn: () => apiFetch<StatsPage<T>>(`/admin/stats/${view}?${params}`),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
    // Keeps the current page on screen while the next one of the same list
    // loads; another list's rows have other fields, so not across lists.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === view ? previous : undefined,
  });
};

// Only for a wallet that is a user; an unknown one is a 400.
export const useUserActivity = (user: string, page: number) => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["admin", "user-activity", address, user.toLowerCase(), page],
    queryFn: () =>
      apiFetch<StatsPage<UserActivity>>(
        `/admin/users/${user}/activity?page=${page}`,
      ),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
    // Keeps the current page on screen while the next one loads, but not
    // another user's rows.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === user.toLowerCase() ? previous : undefined,
  });
};

// How many days the growth page's daily charts cover.
export type GrowthRange = "30" | "90" | "all";

// One UTC day of the growth charts.
export type GrowthDay = {
  // YYYY-MM-DD
  day: string;
  newUsers: number;
  // Of the new users, those who came by an invite link.
  referred: number;
  // Users who checked in, completed a quest or finished a campaign.
  active: number;
  // Users with an action proven by a transaction.
  onchain: number;
};

export type Growth = {
  // Every day of the range, oldest first, empty days included.
  days: GrowthDay[];
  // All time.
  totals: {
    users: number;
    referred: number;
    xLinked: number;
    withXp: number;
    // Active on 2+ and on 7+ different days.
    returned: number;
    regulars: number;
    onchain: number;
  };
  // Weekly signup cohorts (the Monday, YYYY-MM-DD), oldest first. active[k]
  // is how many of the cohort were active k weeks after the signup week.
  cohorts: { week: string; size: number; active: number[] }[];
};

export const useGrowth = (range: GrowthRange) => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["admin", "growth", address, range],
    queryFn: () => apiFetch<Growth>(`/admin/growth?range=${range}`),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
    // The old range stays on screen while the new one loads.
    placeholderData: (previous) => previous,
  });
};

// XP an admin gave by hand; negative points took XP away.
export type XpGrant = {
  id: number;
  address: Address;
  name: string | null;
  points: number;
  // Shown to the user in their activity.
  reason: string;
  // The admin who gave it; null once their account is gone.
  grantedBy: Address | null;
  createdAt: string;
};

export const useXpGrants = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["admin", "xp-grants", address],
    queryFn: () => apiFetch<XpGrant[]>("/admin/xp-grants"),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
  });
};

export const useGrantXp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grant: { address: string; points: number; reason: string }) =>
      apiFetch<{ address: Address; points: number }>("/admin/xp-grants", {
        method: "POST",
        body: JSON.stringify(grant),
      }),
    onSuccess: (result) => {
      toast.success(
        `${result.points > 0 ? "Gave" : "Took"} ${Math.abs(result.points)} XP ${
          result.points > 0 ? "to" : "from"
        } ${shortAddress(result.address)}`,
      );
      // The grant list, and XP in the stats and on the boards.
      return Promise.all(
        ["admin", "leaderboard", "rank"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
};

export type SocialPosts = {
  // The current UTC day, YYYY-MM-DD.
  today: string;
  // Days that have a post, from a week ago to two weeks ahead.
  posts: { day: string; postUrl: string }[];
};

export const useSocialPosts = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["admin", "social-posts", address],
    queryFn: () => apiFetch<SocialPosts>("/admin/social-posts"),
    enabled: Boolean(address),
    retry: retryUnlessNotFound,
  });
};

// Sets a day's post; an empty postUrl removes it. Failures toast like every
// other request.
export const useSetSocialPost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ day, postUrl }: { day: string; postUrl: string }) =>
      apiFetch<{ day: string; postUrl: string | null }>(
        `/admin/social-posts/${day}`,
        { method: "PUT", body: JSON.stringify({ postUrl }) },
      ),
    onSuccess: (result) => {
      toast.success(
        result.postUrl
          ? `Post set for ${result.day}`
          : `Post removed for ${result.day}`,
      );
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "social-posts"],
        }),
        // Today's post is the "like & repost" quest's link.
        queryClient.invalidateQueries({ queryKey: ["quests", "daily"] }),
      ]);
    },
  });
};

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type Quest = {
  id: number;
  slug: string;
  title: string;
  description: string;
  actionUrl: string;
  points: number;
  // False until the backend has an onchain check for this quest.
  claimable: boolean;
};

export type Partner = {
  slug: string;
  title: string;
  description: string;
  // Empty when there's no banner; the UI shows a gradient instead.
  imageUrl: string;
  websiteUrl: string | null;
  // Paid once all tasks are verified.
  rewardXp: number;
};

// Campaign card on the Quests page.
export type CampaignSummary = Partner & { tasks: number };

// The catalog changes only on a seed run, so there's no need to refetch
// it every time a window regains focus.
const CATALOG_STALE_TIME = 5 * 60 * 1000;

export const useDailyQuests = () =>
  useQuery({
    queryKey: ["quests", "daily"],
    queryFn: () => apiFetch<Quest[]>("/quests/daily"),
    staleTime: CATALOG_STALE_TIME,
  });

export const usePartners = () =>
  useQuery({
    queryKey: ["partners"],
    queryFn: () => apiFetch<CampaignSummary[]>("/partners"),
    staleTime: CATALOG_STALE_TIME,
  });

// A campaign's task kind, which decides its buttons.
export type TaskType = "x-follow" | "nft-holder" | "daily-quest" | "onchain";

export type CampaignTask = Quest & { type: TaskType };

// A campaign (partner) with its one-time tasks.
export type Campaign = Partner & { quests: CampaignTask[] };

export const useCampaign = (slug: string | undefined) =>
  useQuery({
    queryKey: ["partners", slug],
    queryFn: () => apiFetch<Campaign>(`/partners/${slug}`),
    enabled: Boolean(slug),
    staleTime: CATALOG_STALE_TIME,
    // A missing campaign is a 404, not worth retrying.
    retry: false,
  });

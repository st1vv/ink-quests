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
  imageUrl: string;
  websiteUrl: string | null;
};

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
    queryFn: () => apiFetch<Partner[]>("/partners"),
    staleTime: CATALOG_STALE_TIME,
  });

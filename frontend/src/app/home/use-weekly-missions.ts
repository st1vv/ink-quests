import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { toast } from "@/lib/notify";

// One of the week's missions. Progress counts what the user already does
// (daily quests, campaigns…) during the current UTC week, Monday to Sunday.
export type WeeklyMission = {
  slug: string;
  title: string;
  description: string;
  points: number;
  progress: number;
  target: number;
  claimed: boolean;
  // For missions made of named parts (e.g. quest categories): which are
  // done. The badges use the daily quest tag colors.
  steps?: { label: string; done: boolean }[];
};

export type WeeklyMissions = {
  // Monday 00:00 UTC of the next week, when the missions reset.
  resetsAt: string;
  missions: WeeklyMission[];
  // Extra XP for claiming every mission of the week.
  bonus: { points: number; claimed: boolean };
};

// Monday 00:00 UTC of next week: when the weekly missions reset.
export const nextUtcMonday = () => {
  const now = new Date();
  const daysLeft = (8 - now.getUTCDay()) % 7 || 7;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysLeft,
    ),
  );
};

// TODO(weekly missions): sample data until the backend serves
// GET /me/weekly-missions; swap the queryFn for apiFetch then.
const sampleMissions = (): WeeklyMissions => ({
  resetsAt: nextUtcMonday().toISOString(),
  missions: [
    {
      slug: "quest-days",
      title: "Quest on 5 different days",
      description: "Complete at least one daily quest on 5 days this week.",
      points: 80,
      progress: 5,
      target: 5,
      claimed: false,
    },
    {
      slug: "daily-quests",
      title: "Complete 10 daily quests",
      description: "Any daily quests count, social ones too.",
      points: 100,
      progress: 7,
      target: 10,
      claimed: false,
    },
    {
      slug: "categories",
      title: "Explore 3 categories",
      description: "Complete daily quests from 3 different categories.",
      points: 120,
      progress: 2,
      target: 3,
      claimed: false,
      steps: [
        { label: "DEX", done: true },
        { label: "Lending", done: true },
      ],
    },
    {
      slug: "campaign",
      title: "Finish a partner campaign",
      description: "Complete every task of any partner campaign.",
      points: 90,
      progress: 1,
      target: 1,
      claimed: true,
    },
  ],
  bonus: { points: 150, claimed: false },
});

const queryKey = (address: string | undefined) => ["weekly-missions", address];

export const useWeeklyMissions = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: queryKey(address),
    queryFn: async () => sampleMissions(),
  });
};

// The weekly bonus is claimed like a mission, under this slug.
export const BONUS_SLUG = "bonus";

// TODO(weekly missions): POST /me/weekly-missions/:slug/claim. For now it
// only marks the mission (or the bonus) claimed on screen.
export const useClaimWeeklyMission = () => {
  const { address } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claim: { slug: string; points: number }) => claim,
    onSuccess: ({ slug, points }) => {
      queryClient.setQueryData<WeeklyMissions>(queryKey(address), (data) =>
        data && slug === BONUS_SLUG
          ? { ...data, bonus: { ...data.bonus, claimed: true } }
          : data && {
              ...data,
              missions: data.missions.map((m) =>
                m.slug === slug ? { ...m, claimed: true } : m,
              ),
            },
      );
      toast.success(
        slug === BONUS_SLUG
          ? `Weekly bonus: +${points} XP`
          : `Mission complete: +${points} XP`,
      );
    },
  });
};

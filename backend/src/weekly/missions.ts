// The weekly mission pool. Every UTC week (Monday to Sunday) gets
// MISSIONS_PER_WEEK of these, each at one of its variants, picked at random
// but the same for everyone (seeded by the week). Progress is counted from
// what users already do; see WeeklyService for how each slug is counted.

export const MISSIONS_PER_WEEK = 3;

export type MissionSlug =
  | 'check-ins'
  | 'daily-quests'
  | 'active-days'
  | 'referrals'
  | 'social-quests';

type PoolEntry = {
  slug: MissionSlug;
  title: (target: number) => string;
  description: (target: number) => string;
  variants: { target: number; points: number }[];
};

export const MISSION_POOL: PoolEntry[] = [
  {
    slug: 'check-ins',
    title: (n) => `Check in on ${n} days`,
    description: (n) => `Do your daily check-in on ${n} days this week.`,
    variants: [
      { target: 5, points: 50 },
      { target: 6, points: 60 },
      { target: 7, points: 70 },
    ],
  },
  {
    slug: 'daily-quests',
    title: (n) => `Complete ${n} daily quests`,
    description: () => 'Any daily quests this week count, social ones too.',
    variants: [
      { target: 5, points: 50 },
      { target: 6, points: 60 },
      { target: 7, points: 70 },
      { target: 8, points: 80 },
      { target: 9, points: 90 },
      { target: 10, points: 100 },
    ],
  },
  {
    slug: 'active-days',
    title: (n) => `Stay active ${n} days`,
    description: (n) =>
      `Check in or complete a quest on ${n} different days this week.`,
    variants: [
      { target: 5, points: 50 },
      { target: 6, points: 60 },
      { target: 7, points: 70 },
    ],
  },
  {
    // A friend counts in the week their referral reward is paid: they
    // linked X and completed an onchain quest (see ReferralsService).
    slug: 'referrals',
    title: (n) => (n === 1 ? 'Invite a friend' : `Invite ${n} friends`),
    description: () =>
      'Invited friends count once they link X and complete a quest this week.',
    variants: [
      { target: 1, points: 50 },
      { target: 2, points: 100 },
      { target: 3, points: 150 },
    ],
  },
  {
    slug: 'social-quests',
    title: (n) => `Complete ${n} social quests`,
    description: () =>
      'Daily quests tagged Social: like and repost, share your progress, join our Telegram.',
    variants: [
      { target: 3, points: 50 },
      { target: 4, points: 60 },
    ],
  },
];

export type PickedMission = {
  slug: MissionSlug;
  title: string;
  description: string;
  target: number;
  points: number;
  sortOrder: number;
};

// 32-bit FNV-1a of the week, the seed of its picks.
const hash = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// mulberry32: a small seeded PRNG, enough to shuffle five entries.
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The missions of the week starting on `week` (its Monday, YYYY-MM-DD).
export const pickMissions = (
  week: string,
  pool: PoolEntry[] = MISSION_POOL,
  count = MISSIONS_PER_WEEK,
): PickedMission[] => {
  const next = random(hash(week));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).map((entry, sortOrder) => {
    const { target, points } =
      entry.variants[Math.floor(next() * entry.variants.length)];
    return {
      slug: entry.slug,
      title: entry.title(target),
      description: entry.description(target),
      target,
      points,
      sortOrder,
    };
  });
};

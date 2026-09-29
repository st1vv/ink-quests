import { createHash } from 'node:crypto';

export const DAILY_QUEST_COUNT = 3;

export type RotationCandidate = { id: number; group: string };

// Deterministic 0..1 numbers from a seed (mulberry32): the same day always
// picks the same quests, whichever server instance does it first.
const seededRandom = (seed: string) => {
  let a = createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T>(items: T[], random: () => number) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Picks the day's quests: `count` different groups (never two variants of
// one quest), preferring groups that weren't shown the day before, and one
// random variant (e.g. the $1, $5 or $10 swap) of each.
export const pickDailyQuests = (
  candidates: RotationCandidate[],
  day: string,
  yesterdaysGroups: Set<string>,
  count = DAILY_QUEST_COUNT,
) => {
  const random = seededRandom(`daily-quests:${day}`);

  const byGroup = new Map<string, number[]>();
  for (const c of [...candidates].sort((x, y) => x.id - y.id)) {
    byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c.id]);
  }

  const groups = shuffle([...byGroup.keys()].sort(), random);
  const fresh = groups.filter((g) => !yesterdaysGroups.has(g));
  const repeats = groups.filter((g) => yesterdaysGroups.has(g));

  return [...fresh, ...repeats].slice(0, count).map((group) => {
    const variants = byGroup.get(group)!;
    return variants[Math.floor(random() * variants.length)];
  });
};

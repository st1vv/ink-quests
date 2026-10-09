import { createHash } from 'node:crypto';

export const DAILY_QUEST_COUNT = 3;
// Holder quests only suit owners of that collection, so a day shows at most
// this many of them.
export const MAX_NFT_QUESTS_PER_DAY = 1;

export type RotationCandidate = {
  id: number;
  group: string;
  // A holder quest (needs an NFT of some collection).
  nft?: boolean;
};

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
// one quest), at most MAX_NFT_QUESTS_PER_DAY of them holder quests,
// preferring groups that weren't shown the day before, and one random
// variant (e.g. the $1, $5 or $10 swap) of each. Fewer than `count` only
// when the catalog runs out of groups that fit.
export const pickDailyQuests = (
  candidates: RotationCandidate[],
  day: string,
  yesterdaysGroups: Set<string>,
  count = DAILY_QUEST_COUNT,
) => {
  const random = seededRandom(`daily-quests:${day}`);

  const byGroup = new Map<string, number[]>();
  const nftGroups = new Set<string>();
  for (const c of [...candidates].sort((x, y) => x.id - y.id)) {
    byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c.id]);
    if (c.nft) nftGroups.add(c.group);
  }

  const groups = shuffle([...byGroup.keys()].sort(), random);
  const fresh = groups.filter((g) => !yesterdaysGroups.has(g));
  const repeats = groups.filter((g) => yesterdaysGroups.has(g));

  const picked: string[] = [];
  let nftPicked = 0;
  for (const group of [...fresh, ...repeats]) {
    if (picked.length === count) break;
    if (nftGroups.has(group)) {
      if (nftPicked === MAX_NFT_QUESTS_PER_DAY) continue;
      nftPicked++;
    }
    picked.push(group);
  }

  return picked.map((group) => {
    const variants = byGroup.get(group)!;
    return variants[Math.floor(random() * variants.length)];
  });
};

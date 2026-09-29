import { pickDailyQuests, type RotationCandidate } from './rotation';

// 8 groups like the real catalog; three of them come in $1/$5/$10 variants.
const CATALOG: RotationCandidate[] = [
  { id: 1, group: 'gm' },
  { id: 2, group: 'swap' },
  { id: 3, group: 'swap' },
  { id: 4, group: 'swap' },
  { id: 5, group: 'weth' },
  { id: 6, group: 'weth' },
  { id: 7, group: 'weth' },
  { id: 8, group: 'templars' },
  { id: 9, group: 'rekt' },
  { id: 10, group: 'bunnies' },
  { id: 11, group: 'relay' },
  { id: 12, group: 'relay' },
  { id: 13, group: 'relay' },
  { id: 14, group: 'usdt' },
];
const groupOf = (id: number) => CATALOG.find((c) => c.id === id)!.group;
const none = new Set<string>();

const days = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(2026, 9, 1) + i * 86400_000).toISOString().slice(0, 10),
  );

describe('pickDailyQuests', () => {
  it('picks 3 quests from 3 different groups', () => {
    for (const day of days(60)) {
      const ids = pickDailyQuests(CATALOG, day, none);
      expect(ids).toHaveLength(3);
      expect(new Set(ids.map(groupOf)).size).toBe(3);
    }
  });

  it('is the same for the same day and differs across days', () => {
    expect(pickDailyQuests(CATALOG, '2026-10-01', none)).toEqual(
      pickDailyQuests(CATALOG, '2026-10-01', none),
    );
    const sets = new Set(
      days(30).map((d) => pickDailyQuests(CATALOG, d, none).join(',')),
    );
    expect(sets.size).toBeGreaterThan(20);
  });

  it('does not depend on the order the catalog comes in', () => {
    const reversed = [...CATALOG].reverse();
    expect(pickDailyQuests(reversed, '2026-10-05', none)).toEqual(
      pickDailyQuests(CATALOG, '2026-10-05', none),
    );
  });

  it("avoids yesterday's groups when there are enough others", () => {
    let yesterday = new Set<string>();
    for (const day of days(60)) {
      const groups = pickDailyQuests(CATALOG, day, yesterday).map(groupOf);
      for (const g of groups) expect(yesterday.has(g)).toBe(false);
      yesterday = new Set(groups);
    }
  });

  it("falls back to yesterday's groups when the catalog is small", () => {
    const small = CATALOG.filter((c) =>
      ['gm', 'swap', 'rekt'].includes(c.group),
    );
    const ids = pickDailyQuests(small, '2026-10-01', new Set(['gm', 'swap']));
    expect(ids.map(groupOf).sort()).toEqual(['gm', 'rekt', 'swap']);
  });

  it('returns what there is when fewer than 3 groups exist', () => {
    const tiny = CATALOG.filter((c) => c.group === 'swap');
    expect(pickDailyQuests(tiny, '2026-10-01', none)).toHaveLength(1);
    expect(pickDailyQuests([], '2026-10-01', none)).toEqual([]);
  });

  it('uses every variant of a group over time', () => {
    const swaps = new Set<number>();
    for (const day of days(120)) {
      for (const id of pickDailyQuests(CATALOG, day, none)) {
        if (groupOf(id) === 'swap') swaps.add(id);
      }
    }
    expect([...swaps].sort()).toEqual([2, 3, 4]);
  });
});

import { levelForXp, levelProgress, xpForLevel } from './level';

describe('level curve', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-5)).toBe(1);
  });

  it('has the expected thresholds', () => {
    expect([1, 2, 3, 4, 5, 10].map(xpForLevel)).toEqual([
      0, 250, 750, 1500, 2500, 11250,
    ]);
  });

  it('levels up exactly at each threshold', () => {
    for (let level = 1; level <= 200; level++) {
      const threshold = xpForLevel(level);
      expect(levelForXp(threshold)).toBe(level);
      if (level > 1) expect(levelForXp(threshold - 1)).toBe(level - 1);
    }
  });

  it('reports the current level window', () => {
    expect(levelProgress(1240)).toEqual({
      level: 3,
      levelXp: 750,
      nextLevelXp: 1500,
    });
  });
});

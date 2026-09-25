// Total XP needed to reach `level`: 0, 250, 750, 1500, 2500, ... Each level
// takes 250 XP more than the one before, so early levels come quickly and
// later ones need a long streak. Change the curve here only: everything
// else derives from it.
const XP_STEP = 250;

export const xpForLevel = (level: number) =>
  (XP_STEP * level * (level - 1)) / 2;

export const levelForXp = (xp: number) => {
  // Inverse of xpForLevel, floored; the loops fix float rounding at the
  // exact thresholds.
  let level = Math.max(
    1,
    Math.floor((1 + Math.sqrt(1 + (8 * Math.max(xp, 0)) / XP_STEP)) / 2),
  );
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
};

export const levelProgress = (xp: number) => {
  const level = levelForXp(xp);
  return {
    level,
    levelXp: xpForLevel(level),
    nextLevelXp: xpForLevel(level + 1),
  };
};

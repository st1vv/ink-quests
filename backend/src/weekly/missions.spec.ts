import { MISSION_POOL, MISSIONS_PER_WEEK, pickMissions } from './missions';

describe('pickMissions', () => {
  it('picks the same missions for the same week', () => {
    expect(pickMissions('2026-11-30')).toEqual(pickMissions('2026-11-30'));
  });

  it('picks MISSIONS_PER_WEEK different missions, in order', () => {
    const picked = pickMissions('2026-11-30');
    expect(picked).toHaveLength(MISSIONS_PER_WEEK);
    expect(new Set(picked.map((m) => m.slug)).size).toBe(MISSIONS_PER_WEEK);
    expect(picked.map((m) => m.sortOrder)).toEqual([0, 1, 2]);
  });

  it('uses one of the pool variants for each mission', () => {
    for (let week = 0; week < 52; week++) {
      const monday = new Date(Date.UTC(2026, 0, 5 + week * 7))
        .toISOString()
        .slice(0, 10);
      for (const m of pickMissions(monday)) {
        const entry = MISSION_POOL.find((e) => e.slug === m.slug)!;
        expect(entry.variants).toContainEqual({
          target: m.target,
          points: m.points,
        });
        expect(m.title).toBe(entry.title(m.target));
      }
    }
  });

  it('varies from week to week and uses every mission', () => {
    const seen = new Set<string>();
    const sets = new Set<string>();
    for (let week = 0; week < 52; week++) {
      const monday = new Date(Date.UTC(2026, 0, 5 + week * 7))
        .toISOString()
        .slice(0, 10);
      const picked = pickMissions(monday);
      picked.forEach((m) => seen.add(m.slug));
      sets.add(picked.map((m) => `${m.slug}:${m.target}`).join(','));
    }
    expect(seen.size).toBe(MISSION_POOL.length);
    expect(sets.size).toBeGreaterThan(10);
  });

  it('words a single referral in the singular', () => {
    const referrals = MISSION_POOL.find((e) => e.slug === 'referrals')!;
    expect(referrals.title(1)).toBe('Invite a friend');
    expect(referrals.title(3)).toBe('Invite 3 friends');
  });
});

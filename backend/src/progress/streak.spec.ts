import { currentStreak, longestStreak } from './streak';

const now = new Date('2026-09-25T15:00:00Z');

describe('currentStreak', () => {
  it('is 0 without completions', () => {
    expect(currentStreak([], now)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-09-25', '2026-09-24', '2026-09-23'], now)).toBe(
      3,
    );
  });

  it('stays alive when the last day is yesterday', () => {
    expect(currentStreak(['2026-09-24', '2026-09-23'], now)).toBe(2);
  });

  it('is broken by a missed day', () => {
    expect(currentStreak(['2026-09-23', '2026-09-22'], now)).toBe(0);
    expect(currentStreak(['2026-09-25', '2026-09-24', '2026-09-22'], now)).toBe(
      2,
    );
  });

  it('crosses month and year boundaries', () => {
    const newYear = new Date('2027-01-01T01:00:00Z');
    expect(
      currentStreak(['2027-01-01', '2026-12-31', '2026-12-30'], newYear),
    ).toBe(3);
  });

  it('uses UTC, not the server time zone', () => {
    // 23:30 UTC on the 25th is already the 26th in Kyiv.
    const lateUtc = new Date('2026-09-25T23:30:00Z');
    expect(currentStreak(['2026-09-25'], lateUtc)).toBe(1);
  });
});

describe('longestStreak', () => {
  it('is 0 without check-ins', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('finds the longest run anywhere in history', () => {
    expect(
      longestStreak([
        '2026-09-25',
        '2026-09-24',
        '2026-09-10',
        '2026-09-09',
        '2026-09-08',
        '2026-09-01',
      ]),
    ).toBe(3);
  });

  it('ignores order and duplicates', () => {
    expect(longestStreak(['2026-09-02', '2026-09-01', '2026-09-02'])).toBe(2);
  });

  it('crosses month and year boundaries', () => {
    expect(longestStreak(['2026-12-31', '2027-01-01', '2027-01-02'])).toBe(3);
  });
});

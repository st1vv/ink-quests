import { completesWeek, utcWeekDays } from './week';

const WEEK = [
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
];

describe('utcWeekDays', () => {
  it('runs Monday to Sunday for any day of the week', () => {
    for (const day of WEEK) {
      expect(utcWeekDays(new Date(`${day}T12:00:00Z`))).toEqual(WEEK);
    }
  });

  it('uses UTC: Sunday 23:30 UTC is still the same week', () => {
    expect(utcWeekDays(new Date('2026-10-04T23:30:00Z'))).toEqual(WEEK);
    expect(utcWeekDays(new Date('2026-10-05T00:00:00Z'))[0]).toBe('2026-10-05');
  });

  it('crosses a year boundary', () => {
    expect(utcWeekDays(new Date('2027-01-01T10:00:00Z'))).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
});

describe('completesWeek', () => {
  const sunday = new Date('2026-10-04T09:00:00Z');
  const monToSat = new Set(WEEK.slice(0, 6));

  it('is true on Sunday after Monday to Saturday', () => {
    expect(completesWeek(monToSat, sunday)).toBe(true);
  });

  it('is false with a missed day', () => {
    const missed = new Set(monToSat);
    missed.delete('2026-10-01');
    expect(completesWeek(missed, sunday)).toBe(false);
  });

  it('is false on any day but Sunday', () => {
    expect(completesWeek(monToSat, new Date('2026-10-03T09:00:00Z'))).toBe(
      false,
    );
  });

  it("ignores last week's days", () => {
    const lastWeek = new Set([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ]);
    expect(completesWeek(lastWeek, sunday)).toBe(false);
  });
});

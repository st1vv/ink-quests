import { isCreditableDay, unixDay } from './check-in-tx';

describe('isCreditableDay', () => {
  const now = new Date('2026-10-21T00:05:00Z');
  const today = unixDay(now);

  it('takes today and, right after midnight, yesterday', () => {
    expect(isCreditableDay(today, now)).toBe(true);
    expect(isCreditableDay(today - 1, now)).toBe(true);
  });

  it('refuses older days, the future and "never" (0)', () => {
    expect(isCreditableDay(today - 2, now)).toBe(false);
    expect(isCreditableDay(today + 1, now)).toBe(false);
    expect(isCreditableDay(0, now)).toBe(false);
  });

  it('matches the contract (block.timestamp / 1 days)', () => {
    expect(unixDay(new Date(1_792_022_400_000))).toBe(1_792_022_400 / 86_400);
    expect(unixDay(new Date('2026-10-21T23:59:59.999Z'))).toBe(today);
  });
});

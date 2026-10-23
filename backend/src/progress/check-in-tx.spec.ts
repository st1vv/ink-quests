import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hex,
} from 'viem';
import {
  checkInAbi,
  isCheckInPayment,
  isCreditableDay,
  unixDay,
} from './check-in-tx';

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

describe('isCheckInPayment', () => {
  const CONTRACT: Address = '0x1111111111111111111111111111111111111111';
  const USER: Address = '0x2222222222222222222222222222222222222222';
  const OTHER: Address = '0x3333333333333333333333333333333333333333';
  const DAY = 20_749;

  const checkedIn = (user: Address, day: number, from: Address = CONTRACT) => ({
    address: from,
    topics: encodeEventTopics({
      abi: checkInAbi,
      eventName: 'CheckedIn',
      args: { user, day: BigInt(day) },
    }) as Hex[],
    data: encodeAbiParameters([{ type: 'uint256' }], [20_000_000_000_000n]),
  });
  const receipt = (
    logs: ReturnType<typeof checkedIn>[],
    status = 'success',
  ) => ({ status, logs });

  it("accepts the user's payment for that day", () => {
    expect(
      isCheckInPayment(receipt([checkedIn(USER, DAY)]), CONTRACT, USER, DAY),
    ).toBe(true);
  });

  it('ignores address letter case', () => {
    expect(
      isCheckInPayment(
        receipt([checkedIn(USER, DAY)]),
        CONTRACT.toUpperCase().replace('0X', '0x') as Address,
        USER,
        DAY,
      ),
    ).toBe(true);
  });

  it('rejects another day, another wallet, another contract, a revert', () => {
    const ok = receipt([checkedIn(USER, DAY)]);
    expect(isCheckInPayment(ok, CONTRACT, USER, DAY - 1)).toBe(false);
    expect(
      isCheckInPayment(receipt([checkedIn(OTHER, DAY)]), CONTRACT, USER, DAY),
    ).toBe(false);
    expect(
      isCheckInPayment(
        receipt([checkedIn(USER, DAY, OTHER)]),
        CONTRACT,
        USER,
        DAY,
      ),
    ).toBe(false);
    expect(
      isCheckInPayment(
        receipt([checkedIn(USER, DAY)], 'reverted'),
        CONTRACT,
        USER,
        DAY,
      ),
    ).toBe(false);
  });

  it('skips unrelated logs of the contract', () => {
    const other = {
      address: CONTRACT,
      topics: [`0x${'00'.repeat(32)}`] as Hex[],
      data: '0x' as Hex,
    };
    expect(
      isCheckInPayment(
        receipt([other, checkedIn(USER, DAY)]),
        CONTRACT,
        USER,
        DAY,
      ),
    ).toBe(true);
  });
});

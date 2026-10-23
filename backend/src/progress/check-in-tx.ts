import { decodeEventLog, parseAbi, type Address, type Hex } from 'viem';

// The CheckIn contract (contracts/src/CheckIn.sol), as far as the backend
// reads it.
export const checkInAbi = parseAbi([
  // The UTC day (unix days) of the wallet's last paid check-in; 0 if none.
  'function lastCheckInDay(address user) view returns (uint256)',
  'event CheckedIn(address indexed user, uint256 indexed day, uint256 paid)',
]);

const DAY_MS = 24 * 60 * 60 * 1000;

// Unix days, the contract's day numbers (block.timestamp / 1 days).
export const unixDay = (at: Date) => Math.floor(at.getTime() / DAY_MS);

// A check-in paid just before midnight UTC may reach us after it, so the
// day before today still counts; older ones don't.
export const isCreditableDay = (day: number, now: Date) => {
  const today = unixDay(now);
  return day === today || day === today - 1;
};

// A transaction receipt, as far as finding a check-in in it goes.
export type CheckInReceipt = {
  status: string;
  logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[];
};

// Whether `receipt` is a successful payment by `user` on our contract for
// `day` (unix days): its CheckedIn event. Read from the event rather than
// the transaction's `to`, so smart wallets calling through an EntryPoint
// match too.
export const isCheckInPayment = (
  receipt: CheckInReceipt,
  contract: Address,
  user: Address,
  day: number,
) =>
  receipt.status === 'success' &&
  receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== contract.toLowerCase()) return false;
    try {
      const event = decodeEventLog({
        abi: checkInAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      return (
        event.eventName === 'CheckedIn' &&
        event.args.user.toLowerCase() === user.toLowerCase() &&
        Number(event.args.day) === day
      );
    } catch {
      // Another event of ours (e.g. an admin one): not a check-in.
      return false;
    }
  });

import { parseAbi } from 'viem';

// The CheckIn contract (contracts/src/CheckIn.sol), as far as the backend
// reads it.
export const checkInAbi = parseAbi([
  // The UTC day (unix days) of the wallet's last paid check-in; 0 if none.
  'function lastCheckInDay(address user) view returns (uint256)',
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

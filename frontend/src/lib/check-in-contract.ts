import { parseAbi } from "viem";

// The paid CheckIn contract on Ink (contracts/src/CheckIn.sol); its address
// comes from the backend (Progress.checkInContract).
export const checkInAbi = parseAbi([
  "function checkIn() payable",
  // Today's price in wei.
  "function fee() view returns (uint256)",
  // The price in USD with 8 decimals: 5_000_000 is $0.05.
  "function feeUsd() view returns (uint256)",
  "error AlreadyCheckedInToday()",
  "error WrongPayment(uint256 sent, uint256 fee)",
  "error NoPrice()",
  "error Paused()",
]);

// Sent on top of the quoted fee, so a small price move between quoting and
// mining doesn't fail the check-in. The contract takes up to 2x the fee.
export const FEE_BUFFER_PERCENT = 1n;

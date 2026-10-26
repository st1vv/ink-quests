import { parseAbi, type Address } from 'viem';

// NFT staking contracts of the NFTStake kind (e.g. Ink Bunnies' on Ink): a
// staked NFT sits in the contract, so the wallet's balanceOf no longer
// shows it, but the contract keeps who staked what.
export const nftStakeAbi = parseAbi([
  'function getUserStakeIds(address user) view returns (uint256[])',
  'function getStakeInfo(uint256 stakeId) view returns (address staker, address nftContract, uint256 tokenId, uint256 planId, uint256 stakedAt, uint256 lockedPointsReward, bool isActive)',
]);

// Stakes looked at per wallet, newest first: enough for anyone still
// staking, and a bound on RPC calls for a wallet with a long history.
export const MAX_STAKES_CHECKED = 50;

export type StakeInfo = readonly [
  staker: Address,
  nftContract: Address,
  tokenId: bigint,
  planId: bigint,
  stakedAt: bigint,
  lockedPointsReward: bigint,
  isActive: boolean,
];

// Whether a stake is `user`'s, still active, of an NFT from `collection`.
// The contract takes any collection, so the collection is checked too.
export const isActiveStakeOf = (
  info: StakeInfo,
  collection: Address,
  user: Address,
) =>
  info[6] &&
  info[0].toLowerCase() === user.toLowerCase() &&
  info[1].toLowerCase() === collection.toLowerCase();

import { parseAbi, type Address } from 'viem';

// A staked NFT sits in the staking contract, so the wallet's balanceOf no
// longer shows it, but the contract keeps who staked what. How to ask
// depends on the contract:
// - 'stake-ids' (NFTStake, e.g. Ink Bunnies'): the wallet's stake ids,
//   each with its collection and whether it's still active. Takes any
//   collection, so the collection is checked per stake.
// - 'held-count' (e.g. Boink's BoinkOGStake): one collection per contract
//   and heldCountOf(wallet), the NFTs the wallet has in it right now.
export type StakingContract = {
  kind: 'stake-ids' | 'held-count';
  address: Address;
};

export const heldCountAbi = parseAbi([
  'function heldCountOf(address holder) view returns (uint256)',
]);

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

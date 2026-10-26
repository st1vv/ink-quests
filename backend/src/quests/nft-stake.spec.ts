import type { Address } from 'viem';
import { isActiveStakeOf, type StakeInfo } from './nft-stake';

const BUNNIES: Address = '0x4443970B315d3c08C2f962fe00770c52396AFDb7';
const OTHER_NFT: Address = '0x1111111111111111111111111111111111111111';
const USER: Address = '0xD0eC58BF62B16803f4Fb82Ee1E61583b237B126F';
const SOMEONE: Address = '0x2222222222222222222222222222222222222222';

const stake = (staker: Address, nft: Address, active: boolean): StakeInfo => [
  staker,
  nft,
  872n,
  2n,
  1_792_869_329n,
  2000n,
  active,
];

describe('isActiveStakeOf', () => {
  it("counts the user's active stake of the collection", () => {
    expect(isActiveStakeOf(stake(USER, BUNNIES, true), BUNNIES, USER)).toBe(
      true,
    );
  });

  it('ignores letter case in addresses', () => {
    expect(
      isActiveStakeOf(
        stake(USER, BUNNIES, true),
        BUNNIES.toLowerCase() as Address,
        USER.toLowerCase() as Address,
      ),
    ).toBe(true);
  });

  it('not once unstaked, not another collection, not someone else', () => {
    expect(isActiveStakeOf(stake(USER, BUNNIES, false), BUNNIES, USER)).toBe(
      false,
    );
    expect(isActiveStakeOf(stake(USER, OTHER_NFT, true), BUNNIES, USER)).toBe(
      false,
    );
    expect(isActiveStakeOf(stake(SOMEONE, BUNNIES, true), BUNNIES, USER)).toBe(
      false,
    );
  });
});

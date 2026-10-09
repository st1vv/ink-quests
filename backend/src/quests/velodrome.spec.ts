import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import type { ExplorerTx } from './explorer.client';
import { VELODROME_UNIVERSAL_ROUTER, velodromeSwapValue } from './velodrome';
import {
  findMatchingTx,
  USD_PRICE_UNIT,
  VERIFIERS,
  withMinUsd,
} from './verifiers';

const WETH: Address = '0x4200000000000000000000000000000000000006';
const USDT0: Address = '0x0200C29006150606B650577BBE7B6248F58470c1';
const MEME: Address = '0x1111111111111111111111111111111111111111';
const OTHER: Address = '0x2222222222222222222222222222222222222222';
const ME: Address = '0x00000000000000000000000000000000000000aa';
const CONTRACT_BALANCE = 1n << 255n;
const ETH = 10n ** 18n;
const USD = 10n ** 6n;

const V3_IN = 0x00;
const V3_OUT = 0x01;
const V2_IN = 0x08;
const V2_OUT = 0x09;
const WRAP_ETH = 0x0b;
const PERMIT2_PERMIT = 0x0a;

const tx = (
  input: Hex,
  value = 0n,
  isError = '0',
  to: string = VELODROME_UNIVERSAL_ROUTER,
): ExplorerTx => ({
  hash: '0x00',
  from: ME,
  to,
  methodId: input.slice(0, 10),
  input,
  value: value.toString(),
  isError,
  timeStamp: '0',
});

// Slipstream path: token, 3-byte tick spacing, token, …
const v3Path = (tokens: Address[]) =>
  encodePacked(
    tokens.flatMap((_, i) => (i === 0 ? ['address'] : ['uint24', 'address'])),
    tokens.flatMap((t, i) => (i === 0 ? [t] : [100, t])),
  );
// Velodrome V2 path: token, 1-byte stable flag, token, …
const veloV2Path = (tokens: Address[]) =>
  encodePacked(
    tokens.flatMap((_, i) => (i === 0 ? ['address'] : ['bool', 'address'])),
    tokens.flatMap((t, i) => (i === 0 ? [t] : [false, t])),
  );
const uniV2Path = (tokens: Address[]) =>
  encodePacked(
    tokens.map(() => 'address'),
    tokens,
  );

const swap = (amount: bigint, bound: bigint, path: Hex, isUni = false) =>
  encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bytes' },
      { type: 'bool' },
      { type: 'bool' },
    ],
    [ME, amount, bound, path, true, isUni],
  );

const abi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
]);
const execute = (steps: [number, Hex][]) =>
  encodeFunctionData({
    abi,
    functionName: 'execute',
    args: [
      `0x${steps.map(([c]) => c.toString(16).padStart(2, '0')).join('')}`,
      steps.map(([, input]) => input),
      9999999999n,
    ],
  });

describe('velodromeSwapValue', () => {
  it('reads the WETH paid into a Slipstream exact-in swap', () => {
    const input = execute([[V3_IN, swap(ETH / 10n, 5n, v3Path([WETH, MEME]))]]);
    expect(velodromeSwapValue(tx(input))).toEqual({
      weth: ETH / 10n,
      usdt0: 0n,
    });
  });

  it('reads the guaranteed USD₮0 out of a token-to-USD₮0 swap', () => {
    const input = execute([
      [V3_IN, swap(123n, 4n * USD, v3Path([MEME, USDT0]))],
    ]);
    expect(velodromeSwapValue(tx(input))).toEqual({
      weth: 0n,
      usdt0: 4n * USD,
    });
  });

  it('reads the output token of an exact-out V3 swap from the start of the path', () => {
    // Exact-out V3 paths run output first: this buys 2 USD₮0 with WETH.
    const input = execute([
      [V3_OUT, swap(2n * USD, ETH, v3Path([USDT0, WETH]))],
    ]);
    // amountInMax (1 ETH) is only a cap and doesn't count.
    expect(velodromeSwapValue(tx(input))).toEqual({
      weth: 0n,
      usdt0: 2n * USD,
    });
  });

  it('reads Velodrome and Uniswap V2 paths', () => {
    const velo = execute([
      [V2_IN, swap(3n * USD, 1n, veloV2Path([USDT0, MEME]))],
    ]);
    expect(velodromeSwapValue(tx(velo))).toEqual({ weth: 0n, usdt0: 3n * USD });

    const uni = execute([
      [V2_IN, swap(ETH / 4n, 1n, uniV2Path([WETH, MEME]), true)],
    ]);
    expect(velodromeSwapValue(tx(uni))).toEqual({ weth: ETH / 4n, usdt0: 0n });
  });

  it('reads the exact amount out of a V2 exact-out swap from the end of the path', () => {
    const input = execute([
      [V2_OUT, swap(ETH / 5n, 10n ** 30n, veloV2Path([MEME, WETH]))],
    ]);
    expect(velodromeSwapValue(tx(input))).toEqual({
      weth: ETH / 5n,
      usdt0: 0n,
    });
  });

  it('counts the ETH sent with WRAP_ETH, not the router-balance marker', () => {
    const input = execute([
      [
        WRAP_ETH,
        encodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }],
          [VELODROME_UNIVERSAL_ROUTER, CONTRACT_BALANCE],
        ),
      ],
      [V3_IN, swap(CONTRACT_BALANCE, 1n, v3Path([WETH, MEME]))],
    ]);
    expect(velodromeSwapValue(tx(input, ETH / 3n))).toEqual({
      weth: ETH / 3n,
      usdt0: 0n,
    });
  });

  it('gives zeros for a token-to-token swap with no WETH or USD₮0', () => {
    const input = execute([[V3_IN, swap(ETH, ETH, v3Path([MEME, OTHER]))]]);
    expect(velodromeSwapValue(tx(input))).toEqual({ weth: 0n, usdt0: 0n });
  });

  it('ignores calls with no swap, failed calls and other contracts', () => {
    const permitOnly = execute([[PERMIT2_PERMIT, '0x']]);
    expect(velodromeSwapValue(tx(permitOnly, ETH))).toBeNull();

    const input = execute([[V3_IN, swap(ETH, 1n, v3Path([WETH, MEME]))]]);
    expect(velodromeSwapValue(tx(input, 0n, '1'))).toBeNull();
    expect(velodromeSwapValue(tx(input, 0n, '0', OTHER))).toBeNull();
    expect(velodromeSwapValue(tx('0xdeadbeef'))).toBeNull();
  });
});

describe('velodrome-swap verifier', () => {
  // WETH at $2,000.
  const priceOf = () => Promise.resolve(2000n * USD_PRICE_UNIT);
  const matches = (
    specs = VERIFIERS['velodrome-swap'],
    input: Hex,
    value = 0n,
  ) => findMatchingTx(specs, [tx(input, value)], priceOf).then(Boolean);

  it('counts USD₮0 at $1', async () => {
    const one = execute([[V3_IN, swap(USD, 1n, v3Path([USDT0, MEME]))]]);
    const almost = execute([
      [V3_IN, swap(USD - 1n, 1n, v3Path([USDT0, MEME]))],
    ]);
    expect(await matches(undefined, one)).toBe(true);
    expect(await matches(undefined, almost)).toBe(false);
  });

  it('prices WETH with the oracle and follows the quest minimum', async () => {
    // $5 of ETH at $2,000 is 0.0025 ETH.
    const fiveDollars = execute([
      [V3_IN, swap(ETH / 400n, 1n, v3Path([WETH, MEME]))],
    ]);
    const five = withMinUsd(VERIFIERS['velodrome-swap'], 5);
    const ten = withMinUsd(VERIFIERS['velodrome-swap'], 10);
    expect(await matches(five, fiveDollars)).toBe(true);
    expect(await matches(ten, fiveDollars)).toBe(false);
  });
});

import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import type { ExplorerTx } from './explorer.client';
import {
  INKYSWAP_UNIVERSAL_ROUTER,
  INKYSWAP_V2_ROUTER,
  inkySwapValue,
  inkySwapWethValue,
} from './swap';
import {
  V4_ETH_TO_USDT0,
  V4_ETH_TO_USDT0_VALUE,
  V4_USDT0_TO_ETH,
} from './swap.fixtures';

const WETH: Address = '0x4200000000000000000000000000000000000006';
const MEME: Address = '0x1111111111111111111111111111111111111111';
const OTHER: Address = '0x2222222222222222222222222222222222222222';
const ME: Address = '0x00000000000000000000000000000000000000aa';
const CONTRACT_BALANCE = 1n << 255n;
const ETH = 10n ** 18n;

const tx = (to: string, input: Hex, value = 0n, isError = '0'): ExplorerTx => ({
  hash: '0x00',
  from: ME,
  to,
  methodId: input.slice(0, 10),
  input,
  value: value.toString(),
  isError,
  timeStamp: '0',
});

const urAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
]);
const v2Input = (amount: bigint, bound: bigint, path: Address[]) =>
  encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'address[]' },
      { type: 'bool' },
    ],
    [ME, amount, bound, path, true],
  );
const execute = (commands: number[], inputs: Hex[]) =>
  encodeFunctionData({
    abi: urAbi,
    functionName: 'execute',
    args: [
      `0x${commands.map((c) => c.toString(16).padStart(2, '0')).join('')}`,
      inputs,
      9999999999n,
    ],
  });

const WRAP_ETH = 0x0b;
const UNWRAP_WETH = 0x0c;
const PERMIT2_PERMIT = 0x0a;
const V2_IN = 0x08;
const V2_OUT = 0x09;
const V4_SWAP = 0x10;
const wrap = encodeAbiParameters(
  [{ type: 'address' }, { type: 'uint256' }],
  [ME, CONTRACT_BALANCE],
);

describe('UniversalRouter swaps', () => {
  it('ETH -> token: takes the ETH sent, not the CONTRACT_BALANCE marker', () => {
    const input = execute(
      [WRAP_ETH, V2_IN],
      [wrap, v2Input(CONTRACT_BALANCE, 1n, [WETH, MEME])],
    );
    // The shape of the swap made from the InkySwap UI: 0.0001 ETH.
    expect(
      inkySwapWethValue(
        tx(INKYSWAP_UNIVERSAL_ROUTER, input, 100_000_000_000_000n),
      ),
    ).toBe(100_000_000_000_000n);
  });

  it('token -> ETH: takes the guaranteed WETH out', () => {
    const input = execute(
      [V2_IN, UNWRAP_WETH],
      [v2Input(5000n, ETH / 100n, [MEME, WETH]), wrap],
    );
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input))).toBe(
      ETH / 100n,
    );
  });

  it('WETH -> token exact in, after a permit: takes amountIn', () => {
    const input = execute(
      [PERMIT2_PERMIT, V2_IN],
      ['0x', v2Input(ETH / 2n, 1n, [WETH, MEME])],
    );
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input))).toBe(
      ETH / 2n,
    );
  });

  it('exact out to WETH: takes the exact amount out; amountInMax never counts', () => {
    const toWeth = execute([V2_OUT], [v2Input(ETH / 4n, 9n, [MEME, WETH])]);
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, toWeth))).toBe(
      ETH / 4n,
    );
    const fromWeth = execute([V2_OUT], [v2Input(5n, ETH, [WETH, MEME])]);
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, fromWeth))).toBe(0n);
  });

  it('V4 swap: counts only the ETH sent with it', () => {
    const input = execute([V4_SWAP], ['0x1234']);
    expect(
      inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input, ETH / 10n)),
    ).toBe(ETH / 10n);
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input))).toBe(0n);
  });

  it('token -> token without WETH: value unknown', () => {
    const input = execute([V2_IN], [v2Input(ETH, 1n, [MEME, OTHER])]);
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input))).toBe(0n);
  });

  it('no swap command (only a permit): not a swap, even with ETH sent', () => {
    const input = execute([PERMIT2_PERMIT], ['0x']);
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input, ETH))).toBe(
      0n,
    );
  });

  it('a reverted transaction never counts', () => {
    const input = execute([V4_SWAP], ['0x1234']);
    expect(
      inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input, ETH, '1')),
    ).toBe(0n);
  });

  it('ignores the command flag bit (0x80, allow revert)', () => {
    const input = execute(
      [0x80 | V2_IN],
      [v2Input(ETH / 2n, 1n, [WETH, MEME])],
    );
    expect(inkySwapWethValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input))).toBe(
      ETH / 2n,
    );
  });
});

describe('InkySwap V2 router swaps', () => {
  const v2Abi = parseAbi([
    'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)',
    'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
    'function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline)',
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
    'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline)',
  ]);
  const call = (
    functionName:
      | 'swapExactETHForTokens'
      | 'swapExactTokensForETH'
      | 'swapTokensForExactETH'
      | 'swapExactTokensForTokens',
    args: readonly unknown[],
  ) =>
    encodeFunctionData({
      abi: v2Abi,
      functionName,
      args: args as never,
    });

  it('swapExactETHForTokens: the ETH sent', () => {
    const input = call('swapExactETHForTokens', [1n, [WETH, MEME], ME, 1n]);
    expect(inkySwapWethValue(tx(INKYSWAP_V2_ROUTER, input, ETH / 3n))).toBe(
      ETH / 3n,
    );
  });

  it('swapExactTokensForETH: the minimum ETH out', () => {
    const input = call('swapExactTokensForETH', [
      99n,
      ETH / 5n,
      [MEME, WETH],
      ME,
      1n,
    ]);
    expect(inkySwapWethValue(tx(INKYSWAP_V2_ROUTER, input))).toBe(ETH / 5n);
  });

  it('swapTokensForExactETH: the exact ETH out', () => {
    const input = call('swapTokensForExactETH', [
      ETH / 7n,
      10n ** 30n,
      [MEME, WETH],
      ME,
      1n,
    ]);
    expect(inkySwapWethValue(tx(INKYSWAP_V2_ROUTER, input))).toBe(ETH / 7n);
  });

  it('swapExactTokensForTokens: the WETH side if there is one', () => {
    const fromWeth = call('swapExactTokensForTokens', [
      ETH / 8n,
      1n,
      [WETH, MEME],
      ME,
      1n,
    ]);
    expect(inkySwapWethValue(tx(INKYSWAP_V2_ROUTER, fromWeth))).toBe(ETH / 8n);
    const noWeth = call('swapExactTokensForTokens', [
      ETH,
      1n,
      [MEME, OTHER],
      ME,
      1n,
    ]);
    expect(inkySwapWethValue(tx(INKYSWAP_V2_ROUTER, noWeth))).toBe(0n);
  });

  it('other router functions (adding liquidity) are not swaps', () => {
    const input = encodeFunctionData({
      abi: v2Abi,
      functionName: 'addLiquidityETH',
      args: [MEME, 1n, 1n, 1n, ME, 1n],
    });
    expect(inkySwapWethValue(tx(INKYSWAP_V2_ROUTER, input, ETH))).toBe(0n);
  });

  it('other contracts are ignored', () => {
    const input = call('swapExactETHForTokens', [1n, [WETH, MEME], ME, 1n]);
    expect(inkySwapWethValue(tx(OTHER, input, ETH))).toBe(0n);
  });
});

describe('InkySwap V4 swaps', () => {
  const USDT0: Address = '0x0200C29006150606B650577BBE7B6248F58470c1';
  const NATIVE: Address = '0x0000000000000000000000000000000000000000';
  const SWAP_EXACT_IN_SINGLE = 0x06;
  const SWAP_EXACT_IN = 0x07;
  const SWAP_EXACT_OUT_SINGLE = 0x08;
  const SWAP_EXACT_OUT = 0x09;
  const SETTLE_ALL = 0x0c;
  const TAKE_ALL = 0x0f;
  const NO_HOOK_DATA: Hex = '0x';

  const poolKey = {
    type: 'tuple',
    components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
  } as const;
  const single = (
    zeroForOne: boolean,
    amount: bigint,
    bound: bigint,
    currency0: Address = NATIVE,
    currency1: Address = USDT0,
  ) =>
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'poolKey', ...poolKey },
            { name: 'zeroForOne', type: 'bool' },
            { name: 'amount', type: 'uint128' },
            { name: 'bound', type: 'uint128' },
            { name: 'hookData', type: 'bytes' },
          ],
        },
      ],
      [
        {
          poolKey: {
            currency0,
            currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: NATIVE,
          },
          zeroForOne,
          amount,
          bound,
          hookData: '0x',
        },
      ],
    );
  const multi = (
    currency: Address,
    path: Address[],
    amount: bigint,
    bound: bigint,
  ) =>
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'currency', type: 'address' },
            {
              name: 'path',
              type: 'tuple[]',
              components: [
                { name: 'intermediateCurrency', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' },
                { name: 'hookData', type: 'bytes' },
              ],
            },
            { name: 'amount', type: 'uint128' },
            { name: 'bound', type: 'uint128' },
          ],
        },
      ],
      [
        {
          currency,
          path: path.map((intermediateCurrency) => ({
            intermediateCurrency,
            fee: 3000,
            tickSpacing: 60,
            hooks: NATIVE,
            hookData: NO_HOOK_DATA,
          })),
          amount,
          bound,
        },
      ],
    );
  const v4 = (actions: number[], params: Hex[]) =>
    encodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes[]' }],
      [
        `0x${actions.map((a) => a.toString(16).padStart(2, '0')).join('')}`,
        params,
      ],
    );
  const router = (input: Hex, value = 0n) =>
    tx(INKYSWAP_UNIVERSAL_ROUTER, input, value);

  it('real USD₮0 -> ETH swap: counts the 5.066669 USD₮0 paid in', () => {
    const value = inkySwapValue(router(V4_USDT0_TO_ETH));
    expect(value?.usdt0).toBe(5_066_669n);
    // And the guaranteed ETH out.
    expect(value?.weth).toBeGreaterThan(0n);
  });

  it('real ETH -> USD₮0 swap: the ETH sent and the minimum USD₮0 out', () => {
    expect(
      inkySwapValue(router(V4_ETH_TO_USDT0, V4_ETH_TO_USDT0_VALUE)),
    ).toEqual({ weth: V4_ETH_TO_USDT0_VALUE, usdt0: 45_243n });
  });

  it('exact out single: only the exact amount out counts', () => {
    // USD₮0 -> exactly 0.002 ETH, paying at most 9 USD₮0.
    const input = execute(
      [V4_SWAP],
      [
        v4(
          [SWAP_EXACT_OUT_SINGLE, SETTLE_ALL, TAKE_ALL],
          [single(false, ETH / 500n, 9_000_000n), '0x', '0x'],
        ),
      ],
    );
    expect(inkySwapValue(router(input))).toEqual({
      weth: ETH / 500n,
      usdt0: 0n,
    });
  });

  it('multi-hop exact in: the amount in and the minimum out at the end', () => {
    // 7 USD₮0 -> MEME -> ETH, at least 0.001 ETH out.
    const input = execute(
      [V4_SWAP],
      [
        v4(
          [SWAP_EXACT_IN],
          [multi(USDT0, [MEME, NATIVE], 7_000_000n, ETH / 1000n)],
        ),
      ],
    );
    expect(inkySwapValue(router(input))).toEqual({
      weth: ETH / 1000n,
      usdt0: 7_000_000n,
    });
  });

  it('multi-hop exact out: only the exact amount out counts', () => {
    // MEME -> exactly 3 USD₮0, at most a lot of MEME.
    const input = execute(
      [V4_SWAP],
      [v4([SWAP_EXACT_OUT], [multi(USDT0, [MEME], 3_000_000n, ETH)])],
    );
    expect(inkySwapValue(router(input))).toEqual({
      weth: 0n,
      usdt0: 3_000_000n,
    });
  });

  it('token -> token with neither asset: nothing known', () => {
    const input = execute(
      [V4_SWAP],
      [v4([SWAP_EXACT_IN_SINGLE], [single(true, ETH, ETH, MEME, OTHER)])],
    );
    expect(inkySwapValue(router(input))).toEqual({ weth: 0n, usdt0: 0n });
  });
});

describe('InkySwap USD₮0 on V2 paths', () => {
  const USDT0: Address = '0x0200C29006150606B650577BBE7B6248F58470c1';

  it('USD₮0 -> WETH exact in: counts the USD₮0 paid in too', () => {
    const input = execute([V2_IN], [v2Input(6_000_000n, 1n, [USDT0, WETH])]);
    expect(inkySwapValue(tx(INKYSWAP_UNIVERSAL_ROUTER, input))).toEqual({
      weth: 1n,
      usdt0: 6_000_000n,
    });
  });
});

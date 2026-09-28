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
  inkySwapWethValue,
} from './swap';

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

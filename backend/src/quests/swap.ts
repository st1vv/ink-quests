import {
  decodeAbiParameters,
  decodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import type { ExplorerTx } from './explorer.client';

// InkySwap on Ink. The UniversalRouter is what the InkySwap UI sends swaps
// to; its V2 factory (0x458C5d5B…) is the one behind the V2 router listed
// in InkySwap's docs (legacy/contracts), so both reach the same pools.
export const INKYSWAP_UNIVERSAL_ROUTER =
  '0x551134e92e537cEAa217c2ef63210Af3CE96a065';
export const INKYSWAP_V2_ROUTER = '0xA8C1C38FF57428e5C3a34E0899Be5Cb385476507';
const WETH = '0x4200000000000000000000000000000000000006';

// What a swap is known to have moved in the two assets we can price: WETH
// (ETH counts as WETH; priced by the oracle) and USD₮0 (at $1). Wei and
// 6-decimal units. Used by the Velodrome check.
export type SwapValue = { weth: bigint; usdt0: bigint };

const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
  'function execute(bytes commands, bytes[] inputs)',
]);

const v2RouterAbi = parseAbi([
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline)',
]);

// UniversalRouter command bytes (the low 6 bits; the top bit only marks a
// command as allowed to revert).
const V2_SWAP_EXACT_IN = 0x08;
const V2_SWAP_EXACT_OUT = 0x09;
const V4_SWAP = 0x10;
const COMMAND_MASK = 0x3f;

// "Use the router's whole balance", e.g. right after WRAP_ETH. Not an
// amount: the ETH sent with the transaction is the real one.
const CONTRACT_BALANCE = 1n << 255n;

const v2SwapParams = [
  { type: 'address' }, // recipient
  { type: 'uint256' }, // exact in: amountIn    | exact out: amountOut
  { type: 'uint256' }, // exact in: amountOutMin | exact out: amountInMax
  { type: 'address[]' }, // path
  { type: 'bool' }, // payerIsUser
] as const;

const isWeth = (a: Address | undefined) => a?.toLowerCase() === WETH;
const max = (a: bigint, b: bigint) => (a > b ? a : b);

// WETH moved by one V2 swap, counting only amounts known to have moved:
// what went in on an exact-in swap, the guaranteed minimum out, or the
// exact amount out. amountInMax is only a cap, so it doesn't count.
const v2WethLeg = (
  exactIn: boolean,
  amount: bigint,
  bound: bigint,
  path: readonly Address[],
) => {
  const wethIn = isWeth(path[0]);
  const wethOut = isWeth(path[path.length - 1]);
  if (exactIn) {
    if (wethIn && amount !== CONTRACT_BALANCE) return amount;
    if (wethOut) return bound;
    return 0n;
  }
  return wethOut ? amount : 0n;
};

const universalRouterValue = (tx: ExplorerTx, paid: bigint) => {
  const { args } = decodeFunctionData({
    abi: universalRouterAbi,
    data: tx.input as Hex,
  });
  const [commands, inputs] = args;
  const bytes = [...Buffer.from(commands.slice(2), 'hex')];

  let swapped = false;
  let value = paid;
  bytes.forEach((raw, i) => {
    const command = raw & COMMAND_MASK;
    if (command === V4_SWAP) swapped = true;
    if (command !== V2_SWAP_EXACT_IN && command !== V2_SWAP_EXACT_OUT) return;
    swapped = true;
    const [, amount, bound, path] = decodeAbiParameters(
      v2SwapParams,
      inputs[i],
    );
    value = max(
      value,
      v2WethLeg(command === V2_SWAP_EXACT_IN, amount, bound, path),
    );
  });
  // A call with no swap command (e.g. only a permit) is not a swap.
  return swapped ? value : 0n;
};

const v2RouterValue = (tx: ExplorerTx, paid: bigint) => {
  const { functionName, args } = decodeFunctionData({
    abi: v2RouterAbi,
    data: tx.input as Hex,
  });
  switch (functionName) {
    case 'swapExactETHForTokens':
    case 'swapExactETHForTokensSupportingFeeOnTransferTokens':
    case 'swapETHForExactTokens':
      return paid;
    case 'swapExactTokensForETH':
    case 'swapExactTokensForETHSupportingFeeOnTransferTokens':
      return args[1]; // amountOutMin of ETH
    case 'swapTokensForExactETH':
      return args[0]; // exact ETH out
    case 'swapExactTokensForTokens':
    case 'swapExactTokensForTokensSupportingFeeOnTransferTokens':
      return v2WethLeg(true, args[0], args[1], args[2]);
    case 'swapTokensForExactTokens':
      return v2WethLeg(false, args[0], args[1], args[2]);
  }
};

// The ETH/WETH value (wei) of a successful InkySwap swap, or 0n when the
// transaction isn't one or its value can't be told (e.g. token-to-token
// with no WETH leg, or a V4 swap paid in tokens).
export const inkySwapWethValue = (tx: ExplorerTx): bigint => {
  if (tx.isError !== '0') return 0n;
  const to = tx.to.toLowerCase();
  const paid = BigInt(tx.value || '0');
  try {
    if (to === INKYSWAP_UNIVERSAL_ROUTER.toLowerCase()) {
      return universalRouterValue(tx, paid);
    }
    if (to === INKYSWAP_V2_ROUTER.toLowerCase()) {
      return v2RouterValue(tx, paid);
    }
  } catch {
    // Some other function on the router (not a swap), or bad calldata.
  }
  return 0n;
};

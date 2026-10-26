import {
  decodeAbiParameters,
  decodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import type { ExplorerTx } from './explorer.client';
import { addV4SwapLegs } from './v4-swap';

// InkySwap on Ink. The UniversalRouter is what the InkySwap UI sends swaps
// to; its V2 factory (0x458C5d5B…) is the one behind the V2 router listed
// in InkySwap's docs (legacy/contracts), so both reach the same pools.
export const INKYSWAP_UNIVERSAL_ROUTER =
  '0x551134e92e537cEAa217c2ef63210Af3CE96a065';
export const INKYSWAP_V2_ROUTER = '0xA8C1C38FF57428e5C3a34E0899Be5Cb385476507';
const WETH = '0x4200000000000000000000000000000000000006';
const USDT0 = '0x0200c29006150606b650577bbe7b6248f58470c1';

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

const max = (a: bigint, b: bigint) => (a > b ? a : b);

const addLeg = (value: SwapValue, token: Address, moved: bigint) => {
  const t = token.toLowerCase();
  if (t === WETH) value.weth = max(value.weth, moved);
  if (t === USDT0) value.usdt0 = max(value.usdt0, moved);
};

// What one V2 swap moved, counting only amounts known to have moved: what
// went in on an exact-in swap (unless it's the router's balance), the
// guaranteed minimum out, or the exact amount out. amountInMax is only a
// cap, so it doesn't count.
const addV2Legs = (
  value: SwapValue,
  exactIn: boolean,
  amount: bigint,
  bound: bigint,
  path: readonly Address[],
) => {
  if (path.length < 2) return;
  const last = path[path.length - 1];
  if (exactIn) {
    if (amount !== CONTRACT_BALANCE) addLeg(value, path[0], amount);
    addLeg(value, last, bound);
  } else {
    addLeg(value, last, amount);
  }
};

const universalRouterValue = (tx: ExplorerTx, paid: bigint) => {
  const { args } = decodeFunctionData({
    abi: universalRouterAbi,
    data: tx.input as Hex,
  });
  const [commands, inputs] = args;
  const value: SwapValue = { weth: paid, usdt0: 0n };

  let swapped = false;
  [...Buffer.from(commands.slice(2), 'hex')].forEach((raw, i) => {
    const command = raw & COMMAND_MASK;
    if (command === V4_SWAP) {
      swapped = true;
      try {
        addV4SwapLegs(value, inputs[i]);
      } catch {
        // Unreadable V4 data: only the ETH sent with it is known.
      }
    }
    if (command !== V2_SWAP_EXACT_IN && command !== V2_SWAP_EXACT_OUT) return;
    swapped = true;
    const [, amount, bound, path] = decodeAbiParameters(
      v2SwapParams,
      inputs[i],
    );
    addV2Legs(value, command === V2_SWAP_EXACT_IN, amount, bound, path);
  });
  // A call with no swap command (e.g. only a permit) is not a swap.
  return swapped ? value : null;
};

const v2RouterValue = (tx: ExplorerTx, paid: bigint): SwapValue | null => {
  const { functionName, args } = decodeFunctionData({
    abi: v2RouterAbi,
    data: tx.input as Hex,
  });
  const value: SwapValue = { weth: paid, usdt0: 0n };
  switch (functionName) {
    case 'swapExactETHForTokens':
    case 'swapExactETHForTokensSupportingFeeOnTransferTokens':
      addV2Legs(value, true, paid, args[0], args[1]);
      return value;
    case 'swapETHForExactTokens':
      addV2Legs(value, false, args[0], 0n, args[1]);
      return value;
    case 'swapExactTokensForETH':
    case 'swapExactTokensForETHSupportingFeeOnTransferTokens':
    case 'swapExactTokensForTokens':
    case 'swapExactTokensForTokensSupportingFeeOnTransferTokens':
      addV2Legs(value, true, args[0], args[1], args[2]);
      return value;
    case 'swapTokensForExactETH':
    case 'swapTokensForExactTokens':
      addV2Legs(value, false, args[0], args[1], args[2]);
      return value;
  }
  return null;
};

// The WETH (ETH counts as WETH) and USD₮0 a successful InkySwap swap moved,
// through its UniversalRouter (V2 and V4 pools) or V2 router; null when
// the transaction isn't one. A swap with neither asset gives zeros: its
// value can't be told.
export const inkySwapValue = (tx: ExplorerTx): SwapValue | null => {
  if (tx.isError !== '0') return null;
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
  return null;
};

// The ETH/WETH side alone (wei), 0n when it isn't a swap or has none.
export const inkySwapWethValue = (tx: ExplorerTx): bigint =>
  inkySwapValue(tx)?.weth ?? 0n;

import {
  decodeAbiParameters,
  decodeFunctionData,
  parseAbi,
  type Hex,
} from 'viem';
import type { ExplorerTx } from './explorer.client';
import type { SwapValue } from './swap';

// Velodrome's UniversalRouter, the one its app (velo.drome.eth.limo) sends
// swaps to on Ink: VITE_UNIVERSAL_ROUTER_ADDRESS_57073 in the app's build. The same address on every Superchain
// network; the older router in velodrome-finance/universal-router's
// deployment-addresses/ink.json (0x01D4…763C) is no longer what the app uses.
export const VELODROME_UNIVERSAL_ROUTER =
  '0xcAF22ce31298CF2BF1D152862F80216478ad7c67';
const WETH = '0x4200000000000000000000000000000000000006';
const USDT0 = '0x0200c29006150606b650577bbe7b6248f58470c1';

const routerAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
  'function execute(bytes commands, bytes[] inputs)',
]);

// Commands (contracts/libraries/Commands.sol), the low 6 bits; the top bit
// only marks a command as allowed to revert.
const V3_SWAP_EXACT_IN = 0x00;
const V3_SWAP_EXACT_OUT = 0x01;
const V2_SWAP_EXACT_IN = 0x08;
const V2_SWAP_EXACT_OUT = 0x09;
const V4_SWAP = 0x10;
const COMMAND_MASK = 0x3f;

// "Use the router's whole balance", e.g. right after WRAP_ETH. Not an
// amount: the ETH sent with the transaction is the real one.
const CONTRACT_BALANCE = 1n << 255n;

// All four swap commands take (recipient, amount, bound, path, payerIsUser,
// isUni). amount/bound are amountIn/amountOutMin on exact-in swaps and
// amountOut/amountInMax on exact-out ones.
const swapParams = [
  { type: 'address' },
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'bytes' },
  { type: 'bool' },
  { type: 'bool' },
] as const;

// Paths are packed bytes, one token every `stride` bytes:
// - V3 (Slipstream, or Uniswap V3 when isUni): token, 3-byte tick spacing
//   or fee, token, …
// - V2 Velodrome pools: token, 1-byte stable flag, token, …
// - V2 Uniswap pools (isUni): tokens only.
const V3_STRIDE = 23;
const VELO_V2_STRIDE = 21;
const UNI_V2_STRIDE = 20;

const pathTokens = (path: Hex, stride: number) => {
  const bytes = path.slice(2).toLowerCase();
  const tokens: string[] = [];
  for (let i = 0; i + 40 <= bytes.length; i += stride * 2) {
    tokens.push(`0x${bytes.slice(i, i + 40)}`);
  }
  return tokens;
};

const max = (a: bigint, b: bigint) => (a > b ? a : b);

// Counts only amounts known to have moved: what went in on an exact-in swap
// (unless it's the router's balance), the guaranteed minimum out, or the
// exact amount out. amountInMax is only a cap, so it doesn't count.
// Exact-out V3 paths run backwards (output token first).
const addLegs = (value: SwapValue, command: number, input: Hex) => {
  const [, amount, bound, path, , isUni] = decodeAbiParameters(
    swapParams,
    input,
  );
  const v3 = command === V3_SWAP_EXACT_IN || command === V3_SWAP_EXACT_OUT;
  const exactIn = command === V3_SWAP_EXACT_IN || command === V2_SWAP_EXACT_IN;
  const tokens = pathTokens(
    path,
    v3 ? V3_STRIDE : isUni ? UNI_V2_STRIDE : VELO_V2_STRIDE,
  );
  if (tokens.length < 2) return;

  const legs: [string, bigint][] = exactIn
    ? [
        [tokens[0], amount === CONTRACT_BALANCE ? 0n : amount],
        [tokens[tokens.length - 1], bound],
      ]
    : [[v3 ? tokens[0] : tokens[tokens.length - 1], amount]];

  for (const [token, moved] of legs) {
    if (token === WETH) value.weth = max(value.weth, moved);
    if (token === USDT0) value.usdt0 = max(value.usdt0, moved);
  }
};

// The WETH and USD₮0 a successful Velodrome swap moved, or null when the
// transaction isn't one. ETH sent with it counts as WETH. A token-to-token
// swap with neither asset gives zeros: its value can't be told.
export const velodromeSwapValue = (tx: ExplorerTx): SwapValue | null => {
  if (tx.isError !== '0') return null;
  if (tx.to.toLowerCase() !== VELODROME_UNIVERSAL_ROUTER.toLowerCase()) {
    return null;
  }

  try {
    const { args } = decodeFunctionData({
      abi: routerAbi,
      data: tx.input as Hex,
    });
    const [commands, inputs] = args;
    const value = { weth: BigInt(tx.value || '0'), usdt0: 0n };

    let swapped = false;
    [...Buffer.from(commands.slice(2), 'hex')].forEach((raw, i) => {
      const command = raw & COMMAND_MASK;
      if (command === V4_SWAP) swapped = true;
      if (
        command !== V3_SWAP_EXACT_IN &&
        command !== V3_SWAP_EXACT_OUT &&
        command !== V2_SWAP_EXACT_IN &&
        command !== V2_SWAP_EXACT_OUT
      ) {
        return;
      }
      swapped = true;
      addLegs(value, command, inputs[i]);
    });
    // A call with no swap command (e.g. only a permit or a bridge) is not
    // a swap.
    return swapped ? value : null;
  } catch {
    // Some other function on the router, or bad calldata.
    return null;
  }
};

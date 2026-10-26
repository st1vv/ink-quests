import { decodeAbiParameters, type Hex } from 'viem';
import type { SwapValue } from './swap';

// Uniswap V4 swaps as a UniversalRouter V4_SWAP command carries them:
// abi.encode(bytes actions, bytes[] params), one param per action byte
// (v4-periphery's Actions.sol). Only the swap actions say what moved; the
// rest (SETTLE, TAKE, …) just pay and collect.
const SWAP_EXACT_IN_SINGLE = 0x06;
const SWAP_EXACT_IN = 0x07;
const SWAP_EXACT_OUT_SINGLE = 0x08;
const SWAP_EXACT_OUT = 0x09;

// Native ETH is currency address(0) in V4; it counts as WETH.
const ETH = '0x0000000000000000000000000000000000000000';
const WETH = '0x4200000000000000000000000000000000000006';
const USDT0 = '0x0200c29006150606b650577bbe7b6248f58470c1';

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

const pathKeys = {
  type: 'tuple[]',
  components: [
    { name: 'intermediateCurrency', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'tickSpacing', type: 'int24' },
    { name: 'hooks', type: 'address' },
    { name: 'hookData', type: 'bytes' },
  ],
} as const;

const singleParams = [
  {
    type: 'tuple',
    components: [
      { name: 'poolKey', ...poolKey },
      { name: 'zeroForOne', type: 'bool' },
      // Exact in: amountIn, amountOutMinimum. Exact out: amountOut,
      // amountInMaximum.
      { name: 'amount', type: 'uint128' },
      { name: 'bound', type: 'uint128' },
      { name: 'hookData', type: 'bytes' },
    ],
  },
] as const;

const multiParams = [
  {
    type: 'tuple',
    components: [
      // Exact in: currencyIn. Exact out: currencyOut.
      { name: 'currency', type: 'address' },
      { name: 'path', ...pathKeys },
      { name: 'amount', type: 'uint128' },
      { name: 'bound', type: 'uint128' },
    ],
  },
] as const;

const max = (a: bigint, b: bigint) => (a > b ? a : b);

const addLeg = (value: SwapValue, currency: string, moved: bigint) => {
  const c = currency.toLowerCase();
  if (c === ETH || c === WETH) value.weth = max(value.weth, moved);
  if (c === USDT0) value.usdt0 = max(value.usdt0, moved);
};

// Adds what a V4_SWAP command moved in WETH (or ETH) and USD₮0 to `value`,
// counting only amounts known to have moved: the amount in on an exact-in
// swap, the guaranteed minimum out, or the exact amount out. An amount in
// of 0 means "the open delta" (whatever an earlier action left), so it's
// not a known amount; amountInMaximum is only a cap.
export const addV4SwapLegs = (value: SwapValue, input: Hex) => {
  const [actions, params] = decodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    input,
  );
  [...Buffer.from(actions.slice(2), 'hex')].forEach((action, i) => {
    if (action === SWAP_EXACT_IN_SINGLE || action === SWAP_EXACT_OUT_SINGLE) {
      const [p] = decodeAbiParameters(singleParams, params[i]);
      const { currency0, currency1 } = p.poolKey;
      const [currencyIn, currencyOut] = p.zeroForOne
        ? [currency0, currency1]
        : [currency1, currency0];
      if (action === SWAP_EXACT_IN_SINGLE) {
        addLeg(value, currencyIn, p.amount);
        addLeg(value, currencyOut, p.bound);
      } else {
        addLeg(value, currencyOut, p.amount);
      }
    }
    if (action === SWAP_EXACT_IN || action === SWAP_EXACT_OUT) {
      const [p] = decodeAbiParameters(multiParams, params[i]);
      if (!p.path.length) return;
      if (action === SWAP_EXACT_IN) {
        addLeg(value, p.currency, p.amount);
        addLeg(value, p.path[p.path.length - 1].intermediateCurrency, p.bound);
      } else {
        addLeg(value, p.currency, p.amount);
      }
    }
  });
};

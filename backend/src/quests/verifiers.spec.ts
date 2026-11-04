import type { Address } from 'viem';
import type { ExplorerTokenTransfer, ExplorerTx } from './explorer.client';
import type { CowOrder } from './cow.client';
import type { RelayRequest } from './relay.client';
import { INKYSWAP_UNIVERSAL_ROUTER } from './swap';
import {
  V4_ETH_TO_USDT0,
  V4_ETH_TO_USDT0_VALUE,
  V4_USDT0_TO_ETH,
} from './swap.fixtures';
import {
  findCowSwap,
  findMatchingTx,
  findTokenBuy,
  isOffchain,
  matchingRelayBridge,
  minUsdOf,
  taskTypeOf,
  withMinUsd,
  USD_PRICE_UNIT,
  VERIFIERS,
  type VerifierSpec,
} from './verifiers';

const POOL = '0x2816cf15f6d2a220e789aa011d5ee4eb6c47feba';
const GATEWAY = '0xde090efcd6ef4b86792e2d84e55a5fa8d49d25d2';
const WETH = '4200000000000000000000000000000000000006';
const USDT = '0200c29006150606b650577bbe7b6248f58470c1';
const USDT_ADDR = '0200c29006150606b650577bbe7b6248f58470c1';
const USDC = '2d270e6886d130d724215a266106e6832161eaed';

const ETH_USD = 2500n;
// 1 ETH = $2500, so $1 is 0.0004 ETH; USDT is pegged and never priced.
const prices = jest.fn((asset: Address) => {
  if (asset.toLowerCase() === `0x${WETH}`) {
    return Promise.resolve(ETH_USD * USD_PRICE_UNIT);
  }
  return Promise.reject(new Error(`unexpected price lookup for ${asset}`));
});

const word = (hex: string) => hex.padStart(64, '0');
const tx = (
  to: string,
  input: string,
  { isError = '0', value = '0' } = {},
): ExplorerTx => ({
  hash: '0x00',
  from: '0x0000000000000000000000000000000000000001',
  to,
  methodId: input.slice(0, 10),
  input,
  value,
  isError,
  timeStamp: '0',
});
const supply = (asset: string, amount: bigint) =>
  `0x617ba037${word(asset)}${word(amount.toString(16))}${word('1')}${word('0')}`;
const depositEth = `0x474cf53d${word(POOL.slice(2))}${word('1')}${word('0')}`;

const ETH = 10n ** 18n;
const USDT_UNIT = 10n ** 6n;

const matches = async (specs: VerifierSpec[], t: ExplorerTx) =>
  (await findMatchingTx(specs, [t], prices)) === t;

describe('tydro-supply-weth', () => {
  const specs = VERIFIERS['tydro-supply-weth'];

  it('accepts $1 of WETH supplied to the pool', async () => {
    expect(await matches(specs, tx(POOL, supply(WETH, ETH / 2500n)))).toBe(
      true,
    );
  });

  it('rejects less than $1 of WETH', async () => {
    expect(await matches(specs, tx(POOL, supply(WETH, ETH / 2500n - 1n)))).toBe(
      false,
    );
  });

  it('accepts $1 of ETH through the gateway, read from tx value', async () => {
    const t = tx(GATEWAY, depositEth, { value: (ETH / 2500n).toString() });
    expect(await matches(specs, t)).toBe(true);
  });

  it('rejects dust ETH through the gateway', async () => {
    const t = tx(GATEWAY, depositEth, { value: '1000' });
    expect(await matches(specs, t)).toBe(false);
  });

  it('rejects supplying another asset, whatever the amount', async () => {
    expect(await matches(specs, tx(POOL, supply(USDC, 10n ** 12n)))).toBe(
      false,
    );
  });

  it('rejects other pool calls, e.g. withdraw(WETH)', async () => {
    const withdraw = `0x69328dec${word(WETH)}${word(ETH.toString(16))}${word('1')}`;
    expect(await matches(specs, tx(POOL, withdraw))).toBe(false);
  });

  it('rejects a failed transaction', async () => {
    const t = tx(POOL, supply(WETH, ETH), { isError: '1' });
    expect(await matches(specs, t)).toBe(false);
  });

  it('rejects calldata too short to hold the amount', async () => {
    expect(await matches(specs, tx(POOL, `0x617ba037${word(WETH)}`))).toBe(
      false,
    );
  });

  it('skips a small supply and finds a big enough one later', async () => {
    const small = tx(POOL, supply(WETH, 1n));
    const big = tx(POOL, supply(WETH, ETH));
    expect(await findMatchingTx(specs, [small, big], prices)).toBe(big);
  });
});

describe('tydro-supply-usdt', () => {
  const specs = VERIFIERS['tydro-supply-usdt'];

  it('accepts exactly 1 USDT, pegged at $1 without an oracle call', async () => {
    prices.mockClear();
    expect(await matches(specs, tx(POOL, supply(USDT, USDT_UNIT)))).toBe(true);
    expect(prices).not.toHaveBeenCalled();
  });

  it('rejects 0.99 USDT', async () => {
    expect(
      await matches(specs, tx(POOL, supply(USDT, (USDT_UNIT * 99n) / 100n))),
    ).toBe(false);
  });

  it('rejects WETH and ETH through the gateway', async () => {
    expect(await matches(specs, tx(POOL, supply(WETH, ETH)))).toBe(false);
    const t = tx(GATEWAY, depositEth, { value: ETH.toString() });
    expect(await matches(specs, t)).toBe(false);
  });
});

describe('ink-gm', () => {
  it('matches a plain gm() with no amount check', async () => {
    const t = tx('0x14aec24ce62258fecde22e928d8f37dd47165d4f', '0xc0129d43');
    expect(await matches(VERIFIERS['ink-gm'], t)).toBe(true);
  });
});

describe('ink-gm-to-inkquests', () => {
  const GM = '0x14aec24ce62258fecde22e928d8f37dd47165d4f';
  const US = '99014f787fa9b21112194e9c8c0a3e4a22d33670';
  const SOMEONE = '1111111111111111111111111111111111111111';
  const specs = VERIFIERS['ink-gm-to-inkquests'];

  it('matches gmTo, gmUnlimitedTo and gmPlusTo sent to us', async () => {
    for (const selector of ['0xe884624b', '0xe9c1b8bb', '0x96c32612']) {
      expect(await matches(specs, tx(GM, selector + word(US)))).toBe(true);
    }
  });

  it('rejects GMs to someone else, by an agent, or without a recipient', async () => {
    expect(await matches(specs, tx(GM, '0xe884624b' + word(SOMEONE)))).toBe(
      false,
    );
    // agentGmTo(address)
    expect(await matches(specs, tx(GM, '0xbae80488' + word(US)))).toBe(false);
    // gm()
    expect(await matches(specs, tx(GM, '0xc0129d43'))).toBe(false);
  });
});

describe('relay-bridge-to-ink', () => {
  const [spec] = VERIFIERS['relay-bridge-to-ink'];
  if (spec.type !== 'relay-bridge') throw new Error('unexpected spec type');
  const USER = '0x00000000000000000000000000000000000000Aa';
  const since = new Date('2026-09-28T00:00:00Z');
  const request = (
    over: Partial<RelayRequest> = {},
    usd = '5',
    origin = 8453,
  ) =>
    ({
      id: '0x1',
      status: 'success',
      user: USER,
      recipient: USER,
      createdAt: '2026-09-28T10:00:00Z',
      data: {
        inTxs: [{ chainId: origin, hash: '0xorigin' }],
        outTxs: [{ chainId: 57073, hash: '0xinktx' }],
        metadata: { currencyIn: { amountUsd: usd } },
      },
      ...over,
    }) as RelayRequest;
  const match = (r: RelayRequest) => matchingRelayBridge(spec, r, USER, since);

  it('returns the Ink tx of a successful $1+ bridge to the user', () => {
    expect(match(request())).toBe('0xinktx');
    expect(match(request({}, '1'))).toBe('0xinktx');
  });

  it('accepts Ethereum, Base, Arbitrum and Robinhood Chain', () => {
    for (const chain of [1, 8453, 42161, 4663]) {
      expect(match(request({}, '5', chain))).toBe('0xinktx');
    }
  });

  it('rejects other origin chains', () => {
    expect(match(request({}, '5', 10))).toBeNull();
  });

  it('rejects less than $1', () => {
    expect(match(request({}, '0.99'))).toBeNull();
  });

  it('rejects unfinished, failed or refunded bridges', () => {
    for (const status of ['pending', 'failure', 'refund']) {
      expect(match(request({ status }))).toBeNull();
    }
  });

  it('rejects a bridge to someone else, even if the user sent it', () => {
    expect(
      match(
        request({ recipient: '0x00000000000000000000000000000000000000Bb' }),
      ),
    ).toBeNull();
  });

  it('accepts a bridge received from another wallet, any address case', () => {
    expect(
      match(
        request({
          user: '0x00000000000000000000000000000000000000cc',
          recipient: USER.toLowerCase(),
        }),
      ),
    ).toBe('0xinktx');
  });

  it('rejects bridges from before today', () => {
    expect(match(request({ createdAt: '2026-09-27T23:59:59Z' }))).toBeNull();
  });
});

describe('withMinUsd', () => {
  it('sets the amount on every amount check and keeps the rest', () => {
    for (const key of [
      'tydro-supply-weth',
      'tydro-supply-usdt',
      'inkyswap-swap',
      'velodrome-swap',
      'relay-bridge-to-ink',
    ]) {
      const specs = withMinUsd(VERIFIERS[key], 10);
      expect(minUsdOf(specs)).toBe(10);
      expect(minUsdOf(VERIFIERS[key])).toBe(1);
    }
  });

  it('has no minimum for verifiers without amounts', () => {
    expect(minUsdOf(VERIFIERS['ink-gm'])).toBeNull();
    expect(minUsdOf(VERIFIERS['ink-gm-to-inkquests'])).toBeNull();
  });

  it('leaves verifiers without amounts, and null, untouched', () => {
    expect(withMinUsd(VERIFIERS['ink-gm'], 5)).toEqual(VERIFIERS['ink-gm']);
    expect(withMinUsd(VERIFIERS['inkyswap-swap'], null)).toBe(
      VERIFIERS['inkyswap-swap'],
    );
  });

  it('a $10 supply quest rejects $5 and accepts $10', async () => {
    const specs = withMinUsd(VERIFIERS['tydro-supply-usdt'], 10);
    const usdt = (units: bigint) =>
      tx(POOL, supply(USDT_ADDR, units * 10n ** 6n));
    expect(await matches(specs, usdt(5n))).toBe(false);
    expect(await matches(specs, usdt(10n))).toBe(true);
  });
});

describe('task types', () => {
  it('treats opening a page as a visit that pays no referral reward', () => {
    expect(taskTypeOf('visit-nado-arcade')).toBe('visit');
    expect(isOffchain(VERIFIERS['visit-nado-arcade'])).toBe(true);
  });

  it('counts a Nado futures trade as an onchain action for referrals', () => {
    expect(taskTypeOf('nado-perp-trade')).toBe('onchain');
    expect(isOffchain(VERIFIERS['nado-perp-trade'])).toBe(false);
  });
});

describe('inkyswap-swap', () => {
  // The real swap a user made for the $5 daily: 5.066669 USD₮0 -> ETH
  // through an InkySwap V4 pool, so no ETH was sent with it.
  const usdtToEth = tx(INKYSWAP_UNIVERSAL_ROUTER, V4_USDT0_TO_ETH);

  it('counts USD₮0 paid into a V4 swap at $1', async () => {
    expect(
      await matches(withMinUsd(VERIFIERS['inkyswap-swap'], 5), usdtToEth),
    ).toBe(true);
  });

  it('still needs the full amount', async () => {
    expect(
      await matches(withMinUsd(VERIFIERS['inkyswap-swap'], 10), usdtToEth),
    ).toBe(false);
  });

  it('a swap worth $0.05 in ETH misses the $1 tier', async () => {
    const small = tx(INKYSWAP_UNIVERSAL_ROUTER, V4_ETH_TO_USDT0, {
      value: V4_ETH_TO_USDT0_VALUE.toString(),
    });
    expect(await matches(VERIFIERS['inkyswap-swap'], small)).toBe(false);
  });
});

describe('buy-anita', () => {
  const [spec] = VERIFIERS['buy-anita'];
  if (spec.type !== 'token-buy') throw new Error('unexpected spec type');
  const ANITA = '0x0606fc632ee812ba970af72f8489baaa443c4b98';
  const POOL = '0x00000000000000000000000000000000000000c0';
  const FRIEND = '0x00000000000000000000000000000000000000f0';
  // $0.001 a token, so $1 is 1000 tokens.
  const PRICE = 0.001;
  const isContract = (address: Address) =>
    Promise.resolve(address.toLowerCase() === POOL);
  const transfer = (
    tokens: bigint,
    over: Partial<ExplorerTokenTransfer> = {},
  ): ExplorerTokenTransfer => ({
    hash: '0xbuy',
    from: POOL,
    to: '0x00000000000000000000000000000000000000aa',
    contractAddress: ANITA,
    value: (tokens * ETH).toString(),
    tokenDecimal: '18',
    timeStamp: '0',
    ...over,
  });
  // The USD of ETH the user sent with each transaction; none by default.
  const find = (
    transfers: ExplorerTokenTransfer[],
    paid: Record<string, number> = {},
  ) =>
    findTokenBuy(spec, transfers, PRICE, isContract, (hash) =>
      Promise.resolve(paid[hash] ?? 0),
    );

  it('accepts $1 of the token received from a contract', async () => {
    expect(await find([transfer(1000n)])).toBe('0xbuy');
  });

  it('accepts $0.95, a few cents short of $1', async () => {
    expect(await find([transfer(950n)])).toBe('0xbuy');
    expect(await find([transfer(10n)], { '0xbuy': 0.95 })).toBe('0xbuy');
  });

  it('rejects less than $0.95, of tokens and of ETH paid', async () => {
    expect(await find([transfer(949n)])).toBeNull();
    expect(await find([transfer(949n)], { '0xbuy': 0.94 })).toBeNull();
  });

  // A real $1 buy on InkyPump: fees and the explorer's price put the
  // tokens at $0.996.
  it('accepts $1 of ETH paid even when the tokens come out short', async () => {
    expect(await find([transfer(996n)], { '0xbuy': 1 })).toBe('0xbuy');
  });

  it('rejects the token sent from another wallet', async () => {
    expect(await find([transfer(5000n, { from: FRIEND })])).toBeNull();
  });

  it('rejects another token, whatever the amount', async () => {
    expect(
      await find([transfer(10n ** 9n, { contractAddress: `0x${USDC}` })]),
    ).toBeNull();
  });

  it('skips a small buy and finds a big enough one later', async () => {
    expect(
      await find([
        transfer(10n, { hash: '0xsmall' }),
        transfer(2000n, { hash: '0xbig' }),
      ]),
    ).toBe('0xbig');
  });

  it('is an onchain task with a $1 minimum', () => {
    expect(taskTypeOf('buy-anita')).toBe('onchain');
    expect(isOffchain(VERIFIERS['buy-anita'])).toBe(false);
    expect(minUsdOf(VERIFIERS['buy-anita'])).toBe(1);
  });
});

describe('cow-swap', () => {
  const [spec] = VERIFIERS['cow-swap'];
  if (spec.type !== 'cow-swap') throw new Error('unexpected spec type');
  const since = new Date('2026-11-04T00:00:00Z');
  const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const order = (over: Partial<CowOrder> = {}): CowOrder => ({
    uid: '0xorder',
    status: 'fulfilled',
    creationDate: '2026-11-04T06:45:08Z',
    sellToken: `0x${USDT}`,
    buyToken: `0x${WETH}`,
    executedSellAmount: String(USDT_UNIT),
    executedBuyAmount: '0',
    ...over,
  });
  const find = (o: CowOrder) => findCowSwap(spec, [o], since, prices);

  it('accepts a settled swap selling 1 USD₮0', async () => {
    expect(await find(order())).toBeDefined();
  });

  it('accepts $1 of ETH sold or WETH bought, at the oracle price', async () => {
    const dollar = (ETH / ETH_USD).toString();
    expect(
      await find(
        order({
          sellToken: NATIVE_ETH,
          executedSellAmount: dollar,
          buyToken: `0x${USDC}`,
        }),
      ),
    ).toBeDefined();
    expect(
      await find(order({ sellToken: `0x${USDC}`, executedBuyAmount: dollar })),
    ).toBeDefined();
  });

  it('rejects less than $1', async () => {
    expect(
      await find(order({ executedSellAmount: String(USDT_UNIT - 1n) })),
    ).toBeUndefined();
  });

  it('rejects unsettled orders and orders from before today', async () => {
    for (const status of ['open', 'cancelled', 'expired']) {
      expect(await find(order({ status }))).toBeUndefined();
    }
    expect(
      await find(order({ creationDate: '2026-11-03T23:59:59Z' })),
    ).toBeUndefined();
  });

  it('rejects swaps with neither ETH nor USD₮0, whatever the amount', async () => {
    expect(
      await find(
        order({
          sellToken: `0x${USDC}`,
          buyToken: '0x0000000000000000000000000000000000000abc',
          executedSellAmount: String(1000n * USDT_UNIT),
        }),
      ),
    ).toBeUndefined();
  });
});

describe('cow-buy-wspyx', () => {
  const [spec] = VERIFIERS['cow-buy-wspyx'];
  if (spec.type !== 'cow-swap') throw new Error('unexpected spec type');
  const since = new Date('2026-11-04T00:00:00Z');
  const WSPYX = '0xe7e553cd128f0011777323a0b44a7b96ea1cb540';
  const USDG = '0xe343167631d89b6ffc58b88d6b7fb0228795491d';
  const WTSLAX = '0xc3fdbe3a68ee5de461d30415a8165cf9aefe1171';
  const order = (over: Partial<CowOrder> = {}): CowOrder => ({
    uid: '0xorder',
    status: 'fulfilled',
    creationDate: '2026-11-04T08:00:00Z',
    sellToken: `0x${USDC}`,
    buyToken: WSPYX,
    executedSellAmount: String(5n * USDT_UNIT),
    executedBuyAmount: '6600000000000000',
    ...over,
  });
  const find = (o: CowOrder) => findCowSwap(spec, [o], since, prices);

  it('accepts $5 of wSPYx bought with USDC', async () => {
    expect(await find(order())).toBeDefined();
  });

  it('accepts $5 bought with USDG, ETH or USD₮0 too', async () => {
    const fiveDollars = ((5n * ETH) / ETH_USD).toString();
    expect(
      await find(
        order({ sellToken: `0x${WETH}`, executedSellAmount: fiveDollars }),
      ),
    ).toBeDefined();
    expect(await find(order({ sellToken: `0x${USDT}` }))).toBeDefined();
    expect(await find(order({ sellToken: USDG }))).toBeDefined();
  });

  it('rejects less than $5', async () => {
    expect(
      await find(order({ executedSellAmount: String(5n * USDT_UNIT - 1n) })),
    ).toBeUndefined();
  });

  it('rejects another stock, whatever the amount', async () => {
    expect(await find(order({ buyToken: WTSLAX }))).toBeUndefined();
  });

  it('rejects selling wSPYx', async () => {
    expect(
      await find(
        order({
          sellToken: WSPYX,
          buyToken: `0x${USDC}`,
          executedSellAmount: '6600000000000000',
          executedBuyAmount: String(5n * USDT_UNIT),
        }),
      ),
    ).toBeUndefined();
  });

  it('keeps USDC out of the plain CoW swap quest', async () => {
    const [plain] = VERIFIERS['cow-swap'];
    if (plain.type !== 'cow-swap') throw new Error('unexpected spec type');
    expect(
      await findCowSwap(
        plain,
        [order({ buyToken: '0x0000000000000000000000000000000000000abc' })],
        since,
        prices,
      ),
    ).toBeUndefined();
  });
});

import type { Address } from 'viem';
import type { ExplorerTx } from './explorer.client';
import type { RelayRequest } from './relay.client';
import {
  findMatchingTx,
  matchingRelayBridge,
  minUsdOf,
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

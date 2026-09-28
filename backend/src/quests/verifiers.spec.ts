import type { Address } from 'viem';
import type { ExplorerTx } from './explorer.client';
import {
  findMatchingTx,
  USD_PRICE_UNIT,
  VERIFIERS,
  type VerifierSpec,
} from './verifiers';

const POOL = '0x2816cf15f6d2a220e789aa011d5ee4eb6c47feba';
const GATEWAY = '0xde090efcd6ef4b86792e2d84e55a5fa8d49d25d2';
const WETH = '4200000000000000000000000000000000000006';
const USDT = '0200c29006150606b650577bbe7b6248f58470c1';
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

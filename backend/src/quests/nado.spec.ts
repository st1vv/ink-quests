import { nadoSubaccount } from './nado';

describe('nadoSubaccount', () => {
  it('is the wallet followed by the zero-padded name', () => {
    // A real subaccount from Nado's archive API.
    expect(
      nadoSubaccount('0x1CCEFC7AC266858840FFB0A206C1F1DA30FE98FD', 'default'),
    ).toBe(
      '0x1ccefc7ac266858840ffb0a206c1f1da30fe98fd64656661756c740000000000',
    );
  });

  it('fits the longest name the app uses in 32 bytes', () => {
    const id = nadoSubaccount(
      '0x0000000000000000000000000000000000000001',
      'default_3',
    );
    expect(id).toHaveLength(66);
    expect(id.endsWith('64656661756c745f33000000')).toBe(true);
  });
});

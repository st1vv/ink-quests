import { stringToHex, type Address, type Hex } from 'viem';

// The subaccounts Nado's app lets a wallet trade from.
export const NADO_SUBACCOUNT_NAMES = [
  'default',
  'default_1',
  'default_2',
  'default_3',
];

// A Nado subaccount id: the wallet's 20 bytes, then the name in 12 bytes,
// zero-padded.
export const nadoSubaccount = (wallet: Address, name: string): Hex =>
  `${wallet.toLowerCase()}${stringToHex(name, { size: 12 }).slice(2)}` as Hex;

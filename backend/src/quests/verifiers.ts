import type { Address, Hex } from 'viem';
import type { ExplorerTx } from './explorer.client';

export type VerifierSpec = {
  // Passes when the user sent a successful transaction to one of these
  // contracts during the quest's window (today for daily quests, since the
  // quest was added for partner quests).
  type: 'contract-call';
  contracts: Address[];
  // Optional 4-byte selectors the transaction must call, e.g. only swaps
  // on a router that also handles liquidity.
  methods?: Hex[];
};

// Quests point at these by key (`verifier` in seed.ts). Take addresses only
// from the protocol's official docs: anyone can deploy a contract named
// after a project, so explorer search results are not a source.
export const VERIFIERS: Record<string, VerifierSpec> = {
  // gm.inkonchain.com: ERC1967 proxy, implementation GMV2. Only a plain GM
  // from the wallet itself counts, not GMs sent to someone else or relayed
  // by an agent. Re-check the selectors if the proxy is upgraded.
  'ink-gm': {
    type: 'contract-call',
    contracts: ['0x14Aec24CE62258FECDe22E928D8F37dD47165d4F'],
    methods: [
      '0xc0129d43', // gm()
      '0x50915b89', // gmPlus()
    ],
  },
};

export const matchesSpec = (spec: VerifierSpec, tx: ExplorerTx) => {
  const to = tx.to.toLowerCase();
  const method = tx.methodId.toLowerCase();
  return (
    tx.isError === '0' &&
    spec.contracts.some((c) => c.toLowerCase() === to) &&
    (!spec.methods || spec.methods.some((m) => m.toLowerCase() === method))
  );
};

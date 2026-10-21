# InkQuests contracts

`src/CheckIn.sol`: the paid daily check-in on Ink. A wallet checks in at most once per UTC day by
paying `feeUsd` worth of ETH ($0.05 by default). The ETH amount comes from Tydro's AaveOracle (the
same prices the app's quests use) and goes straight to the treasury; the contract keeps nothing.
The backend credits the check-in by reading `lastCheckInDay(wallet)` from the contract.

Owner-only settings: `setFeeUsd` (8 decimals: `5_000_000` = $0.05), `setManualEthPrice` (non-zero
overrides the oracle, e.g. while it's down; `0` goes back to it), `setOracle`, `setTreasury`,
`setPaused`, and two-step `transferOwnership` / `acceptOwnership`. A payment below the fee or above
twice the fee is refused; the app sends the fee plus 1% for price moves.

## Setup

Needs [Foundry](https://getfoundry.sh) (`foundryup`). `lib/forge-std` is checked in.

```sh
forge build
forge test
# Also against the real Tydro oracle on a fork of Ink mainnet:
INK_RPC_URL=https://rpc-gel.inkonchain.com forge test --mt fork
```

## Deploy

Keep the deployer key in Foundry's encrypted keystore rather than in an env var or a file:

```sh
cast wallet import deployer --interactive
```

1. **Ink Sepolia first.** There's no Tydro oracle there, so the script prices ETH by hand
   (`MANUAL_ETH_PRICE`, default $2,500):

   ```sh
   TREASURY=0xYourWallet forge script script/DeployCheckIn.s.sol \
     --rpc-url ink_sepolia --account deployer --broadcast --verify
   ```

2. **Ink mainnet**, priced by the Tydro oracle:

   ```sh
   TREASURY=0xYourWallet forge script script/DeployCheckIn.s.sol \
     --rpc-url ink --account deployer --broadcast --verify
   ```

   The deployer becomes the owner. `--verify` publishes the source on the Ink explorer
   (Blockscout, no API key needed).

3. Set `CHECKIN_CONTRACT=<the address>` on the backend (Railway). From then on check-ins are paid;
   without it they stay free (local development).

Never use a public test key or its address (e.g. anvil's defaults) as the treasury on a real
network: those addresses often carry code that sweeps any ETH sent to them.

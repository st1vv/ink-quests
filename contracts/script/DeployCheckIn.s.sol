// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {CheckIn, IPriceOracle} from "../src/CheckIn.sol";

/// Deploys CheckIn. Env:
///   TREASURY          where check-in payments go (required)
///   FEE_USD           price in USD, 8 decimals (default 5_000_000 = $0.05)
///   MANUAL_ETH_PRICE  ETH/USD, 8 decimals, for chains without the Tydro
///                     oracle such as Ink Sepolia (default 2_500e8)
///
/// forge script script/DeployCheckIn.s.sol --rpc-url <rpc> --account <name> --broadcast
contract DeployCheckIn is Script {
    uint256 constant INK_MAINNET = 57073;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    // Tydro's AaveOracle on Ink mainnet (pool → addresses provider →
    // getPriceOracle), the same prices the app's quests use.
    IPriceOracle constant TYDRO_ORACLE = IPriceOracle(0x4758213271BFdC72224A7a8742dC865fC97756e1);

    function run() external returns (CheckIn checkIn) {
        address payable treasury = payable(vm.envAddress("TREASURY"));
        uint256 feeUsd = vm.envOr("FEE_USD", uint256(5_000_000));

        vm.startBroadcast();
        checkIn = new CheckIn(WETH, TYDRO_ORACLE, treasury, feeUsd);
        if (block.chainid != INK_MAINNET) {
            // No Tydro oracle here: price ETH by hand.
            checkIn.setManualEthPrice(vm.envOr("MANUAL_ETH_PRICE", uint256(2_500e8)));
        }
        vm.stopBroadcast();

        console.log("CheckIn:", address(checkIn));
        console.log("Fee now (wei):", checkIn.fee());
    }
}

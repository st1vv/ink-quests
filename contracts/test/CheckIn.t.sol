// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {CheckIn, IPriceOracle} from "../src/CheckIn.sol";

contract MockOracle is IPriceOracle {
    uint256 public price;
    bool public broken;

    function set(uint256 price_) external {
        price = price_;
    }

    function breakIt() external {
        broken = true;
    }

    function getAssetPrice(address) external view returns (uint256) {
        require(!broken, "oracle down");
        return price;
    }
}

contract RejectingTreasury {
    receive() external payable {
        revert("no");
    }
}

contract CheckInTest is Test {
    address constant WETH = 0x4200000000000000000000000000000000000006;
    uint256 constant FEE_USD = 5_000_000; // $0.05
    uint256 constant ETH_PRICE = 2_500e8; // $2,500

    MockOracle oracle;
    CheckIn checkIn;
    address payable treasury = payable(makeAddr("treasury"));
    address user = makeAddr("user");

    event CheckedIn(address indexed user, uint256 indexed day, uint256 paid);

    function setUp() public {
        vm.warp(1_792_000_000); // some time in Oct 2026
        oracle = new MockOracle();
        oracle.set(ETH_PRICE);
        checkIn = new CheckIn(WETH, oracle, treasury, FEE_USD);
        vm.deal(user, 1 ether);
    }

    function test_feeIsFiveCentsOfEth() public view {
        // $0.05 / $2,500 = 0.00002 ETH
        assertEq(checkIn.fee(), 0.00002 ether);
    }

    function test_feeRoundsUp() public {
        oracle.set(3_000e8); // 0.05 / 3000 = 0.0000166… ETH
        assertEq(checkIn.fee(), 16_666_666_666_667);
    }

    function test_checkInPaysTreasuryAndEmits() public {
        uint256 fee = checkIn.fee();
        vm.expectEmit(true, true, false, true);
        emit CheckedIn(user, vm.getBlockTimestamp() / 1 days, fee);
        vm.prank(user);
        checkIn.checkIn{value: fee}();

        assertEq(treasury.balance, fee);
        assertEq(address(checkIn).balance, 0);
        assertTrue(checkIn.hasCheckedInToday(user));
    }

    function test_acceptsASmallBufferAndForwardsAllOfIt() public {
        uint256 paid = (checkIn.fee() * 102) / 100;
        vm.prank(user);
        checkIn.checkIn{value: paid}();
        assertEq(treasury.balance, paid);
    }

    function test_rejectsUnderpayment() public {
        uint256 fee = checkIn.fee();
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(CheckIn.WrongPayment.selector, fee - 1, fee));
        checkIn.checkIn{value: fee - 1}();
    }

    function test_rejectsMoreThanTwiceTheFee() public {
        uint256 fee = checkIn.fee();
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(CheckIn.WrongPayment.selector, fee * 2 + 1, fee));
        checkIn.checkIn{value: fee * 2 + 1}();
    }

    function test_oncePerUtcDay() public {
        uint256 fee = checkIn.fee();
        vm.startPrank(user);
        checkIn.checkIn{value: fee}();

        vm.expectRevert(CheckIn.AlreadyCheckedInToday.selector);
        checkIn.checkIn{value: fee}();

        // Next UTC day: allowed again.
        vm.warp((vm.getBlockTimestamp() / 1 days + 1) * 1 days);
        checkIn.checkIn{value: checkIn.fee()}();
        vm.stopPrank();
        assertEq(checkIn.lastCheckInDay(user), vm.getBlockTimestamp() / 1 days);
    }

    function test_dayBoundaryIsMidnightUtc() public {
        uint256 midnight = (vm.getBlockTimestamp() / 1 days + 1) * 1 days;
        vm.warp(midnight - 1);
        vm.prank(user);
        checkIn.checkIn{value: checkIn.fee()}();

        vm.warp(midnight);
        vm.prank(user);
        checkIn.checkIn{value: checkIn.fee()}();
    }

    function test_walletsAreIndependent() public {
        address other = makeAddr("other");
        vm.deal(other, 1 ether);
        uint256 fee = checkIn.fee();
        vm.prank(user);
        checkIn.checkIn{value: fee}();
        vm.prank(other);
        checkIn.checkIn{value: fee}();
        assertEq(treasury.balance, fee * 2);
    }

    function test_oracleDownRevertsUntilManualPrice() public {
        oracle.breakIt();
        vm.expectRevert(CheckIn.NoPrice.selector);
        checkIn.fee();

        checkIn.setManualEthPrice(2_000e8);
        assertEq(checkIn.fee(), 0.000025 ether);
        vm.prank(user);
        checkIn.checkIn{value: 0.000025 ether}();

        // Back to the oracle once it works again.
        checkIn.setManualEthPrice(0);
        vm.expectRevert(CheckIn.NoPrice.selector);
        checkIn.fee();
    }

    function test_zeroOraclePriceReverts() public {
        oracle.set(0);
        vm.expectRevert(CheckIn.NoPrice.selector);
        checkIn.fee();
    }

    function test_pause() public {
        checkIn.setPaused(true);
        uint256 fee = checkIn.fee();
        vm.prank(user);
        vm.expectRevert(CheckIn.Paused.selector);
        checkIn.checkIn{value: fee}();

        checkIn.setPaused(false);
        vm.prank(user);
        checkIn.checkIn{value: fee}();
    }

    function test_failedTreasuryTransferRevertsTheCheckIn() public {
        checkIn.setTreasury(payable(address(new RejectingTreasury())));
        uint256 fee = checkIn.fee();
        vm.prank(user);
        vm.expectRevert(CheckIn.TreasuryTransferFailed.selector);
        checkIn.checkIn{value: fee}();
        assertFalse(checkIn.hasCheckedInToday(user));
    }

    function test_noPlainEthTransfers() public {
        vm.prank(user);
        (bool ok,) = address(checkIn).call{value: 1 wei}("");
        assertFalse(ok);
    }

    function test_onlyOwnerCanConfigure() public {
        vm.startPrank(user);
        vm.expectRevert(CheckIn.NotOwner.selector);
        checkIn.setFeeUsd(1);
        vm.expectRevert(CheckIn.NotOwner.selector);
        checkIn.setManualEthPrice(1);
        vm.expectRevert(CheckIn.NotOwner.selector);
        checkIn.setOracle(oracle);
        vm.expectRevert(CheckIn.NotOwner.selector);
        checkIn.setTreasury(payable(user));
        vm.expectRevert(CheckIn.NotOwner.selector);
        checkIn.setPaused(true);
        vm.expectRevert(CheckIn.NotOwner.selector);
        checkIn.transferOwnership(user);
        vm.stopPrank();
    }

    function test_setFeeUsdChangesThePrice() public {
        checkIn.setFeeUsd(10_000_000); // $0.10
        assertEq(checkIn.fee(), 0.00004 ether);
    }

    function test_twoStepOwnership() public {
        address next = makeAddr("next");
        checkIn.transferOwnership(next);
        assertEq(checkIn.owner(), address(this));

        vm.prank(user);
        vm.expectRevert(CheckIn.NotPendingOwner.selector);
        checkIn.acceptOwnership();

        vm.prank(next);
        checkIn.acceptOwnership();
        assertEq(checkIn.owner(), next);
        assertEq(checkIn.pendingOwner(), address(0));
    }

    function test_constructorRejectsZeroAddresses() public {
        vm.expectRevert(CheckIn.ZeroAddress.selector);
        new CheckIn(WETH, oracle, payable(address(0)), FEE_USD);
        vm.expectRevert(CheckIn.ZeroAddress.selector);
        new CheckIn(WETH, IPriceOracle(address(0)), treasury, FEE_USD);
    }

    function testFuzz_paymentWindow(uint256 price, uint256 paid) public {
        price = bound(price, 100e8, 100_000e8); // $100 to $100k ETH
        oracle.set(price);
        uint256 fee = checkIn.fee();
        paid = bound(paid, 0, fee * 3);
        vm.deal(user, paid);
        vm.prank(user);
        if (paid < fee || paid > fee * 2) {
            vm.expectRevert(abi.encodeWithSelector(CheckIn.WrongPayment.selector, paid, fee));
        }
        checkIn.checkIn{value: paid}();
    }
}

/// Against Ink mainnet's real Tydro oracle. Runs only with INK_RPC_URL set:
/// INK_RPC_URL=https://rpc-gel.inkonchain.com forge test --mt fork
contract CheckInForkTest is Test {
    address constant WETH = 0x4200000000000000000000000000000000000006;
    // Tydro's AaveOracle (pool → addresses provider → getPriceOracle).
    IPriceOracle constant TYDRO_ORACLE = IPriceOracle(0x4758213271BFdC72224A7a8742dC865fC97756e1);

    function test_fork_realOraclePricesFiveCents() public {
        string memory rpc = vm.envOr("INK_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);

        CheckIn checkIn = new CheckIn(WETH, TYDRO_ORACLE, payable(makeAddr("treasury")), 5_000_000);
        uint256 price = checkIn.ethPrice();
        // A sane ETH price, and a fee worth $0.05 at it.
        assertGt(price, 100e8);
        assertLt(price, 100_000e8);
        assertApproxEqAbs(checkIn.fee() * price / 1e18, 5_000_000, 1);
    }
}

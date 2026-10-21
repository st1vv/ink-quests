// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// Aave's price oracle (Tydro's on Ink): USD prices with 8 decimals.
interface IPriceOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

/// Paid daily check-in for InkQuests. A wallet checks in at most once per
/// UTC day by paying `feeUsd` worth of ETH, priced by the oracle, and the
/// payment goes straight to `treasury`, so the contract keeps no balance.
/// The app's backend credits the check-in by reading `lastCheckInDay`.
contract CheckIn {
    /// ETH, as the oracle prices it (WETH on Ink).
    address public immutable weth;

    address public owner;
    address public pendingOwner;
    address payable public treasury;
    IPriceOracle public oracle;

    /// The price of a check-in in USD, 8 decimals: 5_000_000 is $0.05.
    uint256 public feeUsd;
    /// ETH/USD (8 decimals) set by the owner; when non-zero it replaces the
    /// oracle, e.g. while the oracle is down.
    uint256 public manualEthPrice;
    bool public paused;

    /// The UTC day (unix days) of each wallet's last check-in.
    mapping(address => uint256) public lastCheckInDay;

    /// Paying more than this many times the fee is refused, so a wallet
    /// can't overpay by mistake. The app sends the fee plus a small buffer
    /// for price moves between quoting and sending.
    uint256 public constant MAX_PAYMENT_MULTIPLE = 2;

    event CheckedIn(address indexed user, uint256 indexed day, uint256 paid);
    event FeeUsdSet(uint256 feeUsd);
    event ManualEthPriceSet(uint256 price);
    event OracleSet(address oracle);
    event TreasurySet(address treasury);
    event PausedSet(bool paused);
    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error AlreadyCheckedInToday();
    error WrongPayment(uint256 sent, uint256 fee);
    error NoPrice();
    error Paused();
    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error TreasuryTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address weth_, IPriceOracle oracle_, address payable treasury_, uint256 feeUsd_) {
        if (weth_ == address(0) || address(oracle_) == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        weth = weth_;
        oracle = oracle_;
        treasury = treasury_;
        feeUsd = feeUsd_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// The current UTC day, as unix days.
    function today() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function hasCheckedInToday(address user) external view returns (bool) {
        return lastCheckInDay[user] == today();
    }

    /// ETH/USD with 8 decimals: the manual price if set, else the oracle's.
    function ethPrice() public view returns (uint256 price) {
        if (manualEthPrice != 0) return manualEthPrice;
        try oracle.getAssetPrice(weth) returns (uint256 p) {
            price = p;
        } catch {
            revert NoPrice();
        }
        if (price == 0) revert NoPrice();
    }

    /// Today's check-in price in wei, rounded up.
    function fee() public view returns (uint256) {
        uint256 price = ethPrice();
        return (feeUsd * 1e18 + price - 1) / price;
    }

    function checkIn() external payable {
        if (paused) revert Paused();
        uint256 day = today();
        if (lastCheckInDay[msg.sender] == day) revert AlreadyCheckedInToday();
        uint256 due = fee();
        if (msg.value < due || msg.value > due * MAX_PAYMENT_MULTIPLE) {
            revert WrongPayment(msg.value, due);
        }

        lastCheckInDay[msg.sender] = day;
        emit CheckedIn(msg.sender, day, msg.value);

        // The treasury is set by the owner only.
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool ok,) = treasury.call{value: msg.value}("");
        if (!ok) revert TreasuryTransferFailed();
    }

    // Owner

    function setFeeUsd(uint256 feeUsd_) external onlyOwner {
        feeUsd = feeUsd_;
        emit FeeUsdSet(feeUsd_);
    }

    /// 0 goes back to the oracle.
    function setManualEthPrice(uint256 price) external onlyOwner {
        manualEthPrice = price;
        emit ManualEthPriceSet(price);
    }

    function setOracle(IPriceOracle oracle_) external onlyOwner {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleSet(address(oracle_));
    }

    function setTreasury(address payable treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    /// Two steps, so a typo can't hand the contract to a wrong address.
    /// address(0) cancels a pending transfer.
    // forge-lint: disable-next-line(missing-zero-check)
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}

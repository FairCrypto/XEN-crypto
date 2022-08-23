// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./Math.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IStakingToken.sol";
import "./interfaces/IRankedMintingToken.sol";

contract XENCrypto is Context, IRankedMintingToken, IStakingToken, ERC20("XEN Crypto", "XEN") {
    using Math for uint256;

    // INTERNAL TYPE TO DESCRIBE A RANK STAKE
    struct MintInfo {
        address user;
        uint256 term;
        uint256 maturityTs;
        uint256 rank;
        uint256 amplifier;
    }

    // INTERNAL TYPE TO DESCRIBE A XEN STAKE
    struct StakeInfo {
        uint256 term;
        uint256 maturityTs;
        uint256 amount;
    }

    // PUBLIC CONSTANTS

    uint256 public constant SECONDS_IN_DAY = 3_600 * 24;
    uint256 public constant SECONDS_IN_WEEK = 3_600 * 24 * 7;
    uint256 public constant SECONDS_IN_MONTH = 3_600 * 24 * 30;
    uint256 public constant DAYS_IN_YEAR = 365;

    uint256 public constant GENESIS_RANK = 21;

    uint256 public constant MIN_TERM = 1 * SECONDS_IN_DAY;
    uint256 public constant MAX_TERM_START = 100 * SECONDS_IN_DAY;
    uint256 public constant MAX_TERM_END = 1_000 * SECONDS_IN_DAY;
    uint256 public constant TERM_AMPLIFIER = 15;
    uint256 public constant TERM_AMPLIFIER_THRESHOLD = 5_000;
    uint256 public constant REWARD_AMPLIFIER_START = 3_000;
    uint256 public constant REWARD_AMPLIFIER_END = 300;
    uint256 public constant REWARD_AMPLIFIER_STEP = 45;

    uint256 public constant XEN_MIN_STAKE = 0;
    uint256 public constant XEN_MAX_STAKE = 0; /* Zero means Unlimited Stake Amount */

    uint256 public constant XEN_APR = 20;

    // PUBLIC STATE, READABLE VIA NAMESAKE GETTERS

    uint256 public genesisTs;
    uint256 public globalRank = GENESIS_RANK;
    uint256 public activeMinters;
    uint256 public activeStakes;
    uint256 public totalXenStaked;
    uint256 public currentMaxTerm = MAX_TERM_START;
    // user address => XEN mint info
    mapping(address => MintInfo) public userMints;
    // rank => XEN mint info
    mapping(uint256 => MintInfo) public mintsByRank;
    // user address => XEN stake info
    mapping(address => StakeInfo) public userStakes;

    // CONSTRUCTOR
    constructor() {
        genesisTs = block.timestamp;
    }

    // PRIVATE METHODS

    /**
     * @dev increases Active Stakes, recalculates and saves new MaxTerm
     *      (if over TERM_AMPLIFIER_THRESHOLD)
     */
    function _addStakeAndAdjustMaxTerm() private {
        activeMinters++;
        if (activeMinters > TERM_AMPLIFIER_THRESHOLD) {
            uint256 newMax = MIN_TERM + globalRank.log2() * TERM_AMPLIFIER;
            if (newMax > currentMaxTerm && newMax < MAX_TERM_END) {
                currentMaxTerm = newMax;
            }
        }
    }

    /**
     * @dev calculates Stake Withdrawal Window based on Mint Term
     */
    function _withdrawalWindow(uint256 term) private pure returns (uint256) {
        return (term * SECONDS_IN_DAY).log2();
    }

    /**
     * @dev calculates Withdrawal Penalty (on 128-point scale) depending on lateness
     */
    function _penalty(uint256 window, uint256 secsLate) private pure returns (uint256) {
        // =MIN(2^(F4*8/window),100)
        uint256 daysLate = secsLate / SECONDS_IN_DAY;
        uint256 pwr = (daysLate * 8) / window;
        return Math.min(uint256(1) << pwr, 128) - 1;
    }

    /**
     * @dev calculates net Mint Reward (adjusted for Penalty)
     */
    function _calculateMintReward(
        uint256 cRank,
        uint256 term,
        uint256 maturityTs,
        uint256 amplifier
    ) private view returns (uint256) {
        uint256 secsLate = block.timestamp - maturityTs;
        uint256 penalty = _penalty(_withdrawalWindow(term), secsLate);
        uint256 rankDelta = Math.max(globalRank - cRank, 1);
        uint256 reward = rankDelta.log2() * amplifier * term;
        uint256 adjustedReward = reward / activeMinters.log2();
        return (adjustedReward * (128 - penalty)) >> 7;
    }

    /**
     * @dev cleans up Stake storage (gets some Gas credit;))
     */
    function _cleanUpStake(uint256 cRank) private {
        delete userMints[_msgSender()];
        delete mintsByRank[cRank];
        activeMinters--;
    }

    /**
     * @dev calculates XEN Stake Reward
     */
    function _calculateStakeReward(
        uint256 amount,
        uint256 term,
        uint256 maturityTs
    ) private view returns (uint256) {
        if (block.timestamp > maturityTs) {
            return (amount * XEN_APR * term) / (DAYS_IN_YEAR * 100);
        }
        return 0;
    }

    /**
     * @dev calculates Reward Amplifier
     */
    function _calculateRewardAmplifier() private view returns (uint256) {
        uint256 amplifierDecrease = (REWARD_AMPLIFIER_STEP * (block.timestamp - genesisTs)) / SECONDS_IN_MONTH;
        if (amplifierDecrease < REWARD_AMPLIFIER_START) {
            return Math.max(REWARD_AMPLIFIER_START - amplifierDecrease, REWARD_AMPLIFIER_END);
        } else {
            return REWARD_AMPLIFIER_END;
        }
    }

    // PUBLIC CONVENIENCE GETTERS

    /**
     * @dev returns Rank Stake object associated with User account address
     */
    function getUserMint() external view returns (MintInfo memory) {
        return userMints[_msgSender()];
    }

    /**
     * @dev returns XEN Stake object associated with User account address
     */
    function getUserStake() external view returns (StakeInfo memory) {
        return userStakes[_msgSender()];
    }

    // PUBLIC STATE-CHANGING METHODS

    /**
     * @dev accepts User Rank Stake provided all checks pass (incl. no current Stake)
     */
    function claimRank(uint256 term) external {
        uint256 termSec = term * SECONDS_IN_DAY;
        require(termSec > MIN_TERM, "CRank: Term less than min");
        require(termSec < currentMaxTerm, "CRank: Term more than current max term");
        require(userMints[_msgSender()].rank == 0, "CRank: Stake exists");

        // create and store new MintInfo
        MintInfo memory mintInfo = MintInfo({
            user: _msgSender(),
            term: term,
            maturityTs: block.timestamp + termSec,
            rank: globalRank,
            amplifier: _calculateRewardAmplifier()
        });
        userMints[_msgSender()] = mintInfo;
        mintsByRank[globalRank] = mintInfo;
        _addStakeAndAdjustMaxTerm();
        emit RankClaimed(_msgSender(), term, globalRank++);
    }

    /**
     * @dev ends minting upon maturity (and within permitted Withdrawal time Window), gets minted XEN
     */
    function claimMintReward() external {
        MintInfo memory mintInfo = userMints[_msgSender()];
        require(mintInfo.rank > 0, "CRank: No stake exists");
        require(block.timestamp > mintInfo.maturityTs, "CRank: Stake maturity not reached");

        // calculate reward and mint tokens
        uint256 rewardAmount = _calculateMintReward(
            mintInfo.rank,
            mintInfo.term,
            mintInfo.maturityTs,
            mintInfo.amplifier
        );
        _mint(_msgSender(), rewardAmount);

        _cleanUpStake(mintInfo.rank);
        emit MintClaimed(_msgSender(), rewardAmount);
    }

    /**
     * @dev  ends Rank Stake upon maturity (and within permitted Withdrawal time Window)
     *       mints XEN coins and splits them between User and designated other address
     */
    function claimMintRewardAndShare(address other, uint256 pct) external {
        MintInfo memory mintInfo = userMints[_msgSender()];
        require(other != address(0), "CRank: Cannot share with zero address");
        require(pct > 0, "CRank: Cannot share zero percent");
        require(pct < 101, "CRank: Cannot share 100+ percent");
        require(mintInfo.rank > 0, "CRank: No stake exists");
        require(block.timestamp > mintInfo.maturityTs, "CRank: Stake maturity not reached");

        // calculate reward
        uint256 rewardAmount = _calculateMintReward(
            mintInfo.rank,
            mintInfo.term,
            mintInfo.maturityTs,
            mintInfo.amplifier
        );
        uint256 sharedReward = (rewardAmount * pct) / 100;
        uint256 ownReward = rewardAmount - sharedReward;

        // mint reward tokens
        _mint(_msgSender(), ownReward);
        _mint(other, sharedReward);

        _cleanUpStake(mintInfo.rank);
        emit MintClaimed(_msgSender(), rewardAmount);
    }

    /**
     * @dev initiates XEN Stake in amount for a term (days)
     */
    function stake(uint256 amount, uint256 term) external {
        require(balanceOf(_msgSender()) >= amount, "XEN: not enough balance");
        require(amount > XEN_MIN_STAKE, "XEN: Below min stake");
        require(term * SECONDS_IN_DAY > MIN_TERM, "XEN: Below min term");
        require(term * SECONDS_IN_DAY < MAX_TERM_END, "XEN: Above max term");
        require(userStakes[_msgSender()].amount == 0, "XEN: stake exists");

        // create XEN Stake
        userStakes[_msgSender()] = StakeInfo({
            term: term,
            maturityTs: block.timestamp + term * SECONDS_IN_DAY,
            amount: amount
        });
        activeStakes++;
        totalXenStaked += amount;

        // burn staked XEN
        _burn(_msgSender(), amount);
        emit Staked(_msgSender(), amount, term);
    }

    /**
     * @dev ends XEN Stake and gets reward if the Stake is mature
     */
    function withdraw() external {
        StakeInfo memory userStake = userStakes[_msgSender()];
        require(userStake.amount > 0, "XEN: no stake exists");

        uint256 xenReward = _calculateStakeReward(userStake.amount, userStake.term, userStake.maturityTs);
        activeStakes--;
        totalXenStaked -= userStake.amount;

        // mint staked XEN (+ reward)
        _mint(_msgSender(), userStake.amount + xenReward);
        emit Withdrawn(_msgSender(), userStake.amount, xenReward);
        delete userStakes[_msgSender()];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./Context.sol";
import "./Math.sol";
import "./ERC20.sol";
import "./interfaces/IStakingToken.sol";
import "./interfaces/IRankClaimingToken.sol";

contract XENCrypto is
    Context,
    IRankClaimingToken,
    IStakingToken,
    ERC20("XEN Crypto", "XEN")
{
    using Math for uint256;

    // INTERNAL TYPE TO DESCRIBE A RANK STAKE
    struct RankStakeInfo {
        address user;
        uint256 term;
        uint256 maturityTs;
        uint256 rank;
    }

    // INTERNAL TYPE TO DESCRIBE A XEN STAKE
    struct XenStakeInfo {
        uint256 term;
        uint256 maturityTs;
        uint256 amount;
        uint256 APY;
    }

    // PUBLIC CONSTANTS

    uint256 constant public SECONDS_IN_DAY = 3_600 * 24;
    uint256 constant public SECONDS_IN_WEEK = 3_600 * 24 * 7;
    uint256 constant public DAYS_IN_YEAR = 365;

    uint256 constant public GENESIS_RANK = 21;

    uint256 constant public MIN_TERM = 1 * SECONDS_IN_DAY;
    uint256 constant public MAX_TERM_START = 100 * SECONDS_IN_DAY;
    uint256 constant public MAX_TERM_END = 1_000 * SECONDS_IN_DAY;
    uint256 constant public TERM_AMPLIFIER = 15;
    uint256 constant public TERM_AMPLIFIER_THRESHOLD = 5_000;
    uint256 constant public RANK_AMPLIFIER = 3_000;

    uint256 constant public XEN_MIN_STAKE = 0;
    uint256 constant public XEN_MAX_STAKE = 0; /* Zero means Unlimited Stake Amount */

    uint256 constant public XEN_MAX_APY = 20;
    uint256 constant public XEN_MIN_APY = 2;
    uint256 constant public XEN_APY_CORRECTION_INTERVAL = 90;

    // PUBLIC STATE, READABLE VIA NAMESAKE GETTERS

    uint256 public genesisTs;
    uint256 public globalRank = GENESIS_RANK;
    uint256 public activeRankStakes;
    uint256 public activeXenStakes;
    uint256 public totalXenStaked;
    uint256 public currentMaxTerm = MAX_TERM_START;
    // user address => rank stake info
    mapping(address => RankStakeInfo) public userRankStakes;
    // rank => stake info
    mapping(uint256 => RankStakeInfo) public rankStakes;
    // user address => xen stake info
    mapping(address => XenStakeInfo) public userXenStakes;

    // CONSTRUCTOR

    constructor() {
        genesisTs = block.timestamp;
    }

    // PRIVATE METHODS

    /**
     * @dev increases Active Stakes, recalculates and saves new MaxTerm
     *      (if over TERM_AMPLIFIER_THRESHOLD)
     */
    function _addStakeAndAdjustMaxTerm()
        private
    {
        activeRankStakes++;
        if (activeRankStakes > TERM_AMPLIFIER_THRESHOLD) {
            uint256 newMax = MIN_TERM + activeRankStakes.log2() * TERM_AMPLIFIER;
            if (newMax > currentMaxTerm && newMax < MAX_TERM_END) {
                currentMaxTerm = newMax;
            }
        }
    }

    /**
    * @dev calculates Stake Withdrawal Window based on Stake Term
    */
    function _withdrawalWindow(uint256 userTerm)
        private
        pure
        returns(uint256)
    {
        return (userTerm * SECONDS_IN_DAY).log2();
    }

    /**
    * @dev calculates Withdrawal Penalty (on 128-point scale) depending on lateness
    */
    function _penalty(uint256 window, uint256 secsLate)
        private
        pure
        returns(uint256)
    {
        // =MIN(2^(F4*8/window),100)
        uint256 daysLate = secsLate / SECONDS_IN_DAY;
        uint256 pwr = daysLate * 8 / window;
        return Math.min(uint256(1) << pwr, 128) - 1;
    }

    /**
    * @dev calculates net Stake Reward (adjusted for Penalty)
    */
    function _calculateReward(uint256 userRank, uint256 userTerm, uint256 maturityTs)
        private
        view
        returns(uint256)
    {
        uint256 secsLate = block.timestamp - maturityTs;
        uint256 penalty = _penalty(_withdrawalWindow(userTerm), secsLate);
        uint256 rankDelta = globalRank - userRank;
        uint256 reward = rankDelta.log2() * RANK_AMPLIFIER * userTerm;
        return (reward * (128 - penalty)) >> 7;
    }

    /**
    * @dev cleans up Stake storage (gets some Gas credit;))
    */
    function _cleanUpStake(uint256 rank)
        private
    {
        delete userRankStakes[_msgSender()];
        delete rankStakes[rank];
        activeRankStakes--;
    }

    /**
    * @dev calculates XEN Stake Reward
    */
    function _calculateStakeReward(XenStakeInfo memory userStake)
        private
        view
        returns (uint256)
    {
        if (block.timestamp > userStake.maturityTs) {
            return userStake.amount * userStake.APY * userStake.term / (DAYS_IN_YEAR * 100);
        }
        return 0;
    }

    // PUBLIC GETTERS

    /**
    * @dev returns Rank Stake object associated with User account address
    */
    function getUserRankStake()
        external
        view
        returns (RankStakeInfo memory)
    {
        return userRankStakes[_msgSender()];
    }

    /**
    * @dev returns XEN Stake object associated with User account address
    */
    function getUserXenStake()
        external
        view
        returns (XenStakeInfo memory)
    {
        return userXenStakes[_msgSender()];
    }

    /**
    * @dev calculates and returns current XEN APY
    */
    function currentAPY()
        public
        view
        returns (uint256)
    {
        uint256 decrease =
            Math.min((block.timestamp - genesisTs)/(SECONDS_IN_DAY * 90), XEN_MAX_APY);
        return Math.max(XEN_MAX_APY - decrease, XEN_MIN_APY);
    }

    // PUBLIC STATE-CHANGING METHODS

    /**
    * @dev accepts User Rank Stake provided all checks pass (incl. no current Stake)
    */
    function claimRank(uint256 term)
        external
    {
        uint256 termSec = term * SECONDS_IN_DAY;
        require(termSec > MIN_TERM, 'cRank: Term less than min');
        require(termSec < currentMaxTerm, 'cRank: Term more than current max term');
        require(userRankStakes[_msgSender()].rank == 0, 'cRank: Stake exists');

        // create and store new stakeInfo
        RankStakeInfo memory stakeInfo = RankStakeInfo({
            user: _msgSender(),
            term: term,
            maturityTs: block.timestamp + termSec,
            rank: globalRank
        });
        userRankStakes[_msgSender()] = stakeInfo;
        rankStakes[globalRank] = stakeInfo;
        _addStakeAndAdjustMaxTerm();
        emit RankClaimed(_msgSender(), term, globalRank++);
    }

    /**
    * @dev ends Rank Stake upon maturity (and within permitted Withdrawal time Window), mints XEN coins
    */
    function claimRankReward()
        external
    {
        RankStakeInfo memory userStake = userRankStakes[_msgSender()];
        require(userStake.rank > 0, 'cRank: Mo stake exists');
        require(block.timestamp > userStake.maturityTs, 'cRank: Stake maturity not reached');

        // calculate reward and mint tokens
        uint256 rewardAmount = _calculateReward(userStake.rank, userStake.term, userStake.maturityTs);
        _mint(_msgSender(), rewardAmount);

        _cleanUpStake(userStake.rank);
        emit RankRewardClaimed(_msgSender(),  rewardAmount);
    }

    /**
    * @dev  ends Rank Stake upon maturity (and within permitted Withdrawal time Window)
    *       mints XEN coins and splits them between User and designated other address
    */
    function claimRankRewardAndShare(address other, uint256 pct)
        external
    {
        RankStakeInfo memory userStake = userRankStakes[_msgSender()];
        require(userStake.rank > 0, 'cRank: Mo stake exists');
        require(block.timestamp > userStake.maturityTs, 'cRank: Stake maturity not reached');
        require(other != address(0), 'cRank: Cannot share with zero address');
        require(pct > 0, 'cRank: Cannot share zero percent');
        require(pct < 101, 'cRank: Cannot share 100+ percent');

        // calculate reward
        uint256 rewardAmount = _calculateReward(userStake.rank, userStake.term, userStake.maturityTs);
        uint256 sharedReward = (rewardAmount * pct) / 100;
        uint256 ownReward = rewardAmount - sharedReward;

        // mint reward tokens
        _mint(_msgSender(), ownReward);
        _mint(other, sharedReward);

        _cleanUpStake(userStake.rank);
        emit RankRewardClaimed(_msgSender(),  rewardAmount);
    }

    /**
     * @dev initiates XEN Stake in amount for a term (days)
     */
    function stake(uint256 amount, uint256 term)
        external
    {
        require(balanceOf(_msgSender()) >= amount, 'XEN: not enough balance');
        require(amount > XEN_MIN_STAKE, 'XEN: Below min stake');
        require(term * SECONDS_IN_DAY > MIN_TERM, 'XEN: Below min term');
        require(term * SECONDS_IN_DAY < MAX_TERM_END, 'XEN: Above max term');
        require(userXenStakes[_msgSender()].amount == 0, 'XEN: stake exists');

        // create XEN Stake
        userXenStakes[_msgSender()] = XenStakeInfo({
            term: term,
            maturityTs: block.timestamp + term * SECONDS_IN_DAY,
            amount: amount,
            APY: currentAPY()
        });
        activeXenStakes++;
        totalXenStaked += amount;

        // burn staked XEN
        _burn(_msgSender(), amount);
        emit Staked(_msgSender(), amount, term);
    }

    /**
     * @dev ends XEN Stake and gets reward if the Stake is mature
     */
    function withdraw()
        external
    {
        XenStakeInfo memory userStake = userXenStakes[_msgSender()];
        require(userStake.amount > 0, 'XEN: no stake exists');

        uint256 xenReward = _calculateStakeReward(userStake);
        activeXenStakes--;
        totalXenStaked -= userStake.amount;

        // mint staked XEN (+ reward)
        _mint(_msgSender(), userStake.amount + xenReward);
        emit Withdrawn(_msgSender(), userStake.amount, xenReward);
        delete userXenStakes[_msgSender()];
    }

}

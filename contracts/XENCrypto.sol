// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8;

import "./Context.sol";
import "./Math.sol";
import "./ERC20.sol";
import "./interfaces/IStakingToken.sol";

contract XENCrypto is
    Context,
    IStakingToken,
    ERC20("XEN Crypto", "XEN")
{
    using Math for uint256;

    // INTERNAL TYPE TO DESCRIBE A STAKE
    struct StakeInfo {
        address user;
        uint256 term;
        uint256 maturityTs;
        uint256 rank;
    }

    uint256 constant public SECONDS_IN_DAY = 3_600 * 24;
    uint256 constant public SECONDS_IN_WEEK = 3_600 * 24 * 7;
    uint256 constant public GENESIS_RANK = 21;
    uint256 constant public MIN_TERM = 1 * SECONDS_IN_DAY;
    uint256 constant public MAX_TERM_START = 100 * SECONDS_IN_DAY;
    uint256 constant public MAX_TERM_END = 1_000 * SECONDS_IN_DAY;
    uint256 constant public TERM_AMPLIFIER = 25;
    uint256 constant public RANK_AMPLIFIER = 3_000;

    // PUBLIC STATE, READABLE VIA NAMESAKE GETTERS

    uint256 public globalRank = GENESIS_RANK;
    uint256 public activeStakes;
    uint256 public currentMaxTerm = MAX_TERM_START;
    // user address => stake info
    mapping(address => StakeInfo) public userStakes;
    // rank => stake info
    mapping(uint256 => StakeInfo) public rankStakes;

    // PRIVATE

    function _addStakeAndAdjustMaxTerm()
        private
    {
        activeStakes++;
        uint256 newMax = MIN_TERM + activeStakes.log2() * TERM_AMPLIFIER;
        if (newMax > currentMaxTerm && newMax < MAX_TERM_END) {
            currentMaxTerm = newMax;
        }
    }

    function _withdrawalWindow(uint256 userTerm)
        private
        pure
        returns(uint256)
    {
        return (userTerm * SECONDS_IN_DAY).log2();
    }

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

    function _cleanUpStake(uint256 rank)
        private
    {
        delete userStakes[_msgSender()];
        delete rankStakes[rank];
        activeStakes--;
    }

    // PUBLIC CONVENIENCE GETTER

    function getUserStake()
        external
        view
        returns (StakeInfo memory)
    {
        return userStakes[_msgSender()];
    }

    // PUBLIC STATE-CHANGING METHODS

    function stake(uint256 term)
        external
    {
        uint256 termSec = term * SECONDS_IN_DAY;
        require(termSec > MIN_TERM, 'Term less than min');
        require(termSec < currentMaxTerm, 'Term more than current max term');
        require(userStakes[_msgSender()].rank == 0, 'Stake exists');

        // create and store new stakeInfo
        StakeInfo memory stakeInfo = StakeInfo({
            user: _msgSender(),
            term: term,
            maturityTs: block.timestamp + termSec,
            rank: globalRank
        });
        userStakes[_msgSender()] = stakeInfo;
        rankStakes[globalRank] = stakeInfo;
        _addStakeAndAdjustMaxTerm();
        emit Staked(_msgSender(), term, globalRank++);
    }

    function withdraw()
        external
    {
        StakeInfo memory userStake = userStakes[_msgSender()];
        require(userStake.rank > 0, 'Mo stake exists');
        require(block.timestamp > userStake.maturityTs, 'Stake maturity not reached');

        // calculate reward and mint tokens
        uint256 rewardAmount = _calculateReward(userStake.rank, userStake.term, userStake.maturityTs);
        _mint(_msgSender(), rewardAmount);

        _cleanUpStake(userStake.rank);
        emit Withdrawn(_msgSender(),  rewardAmount);
    }

    function withdrawAndShare(address other, uint256 pct)
        external
    {
        StakeInfo memory userStake = userStakes[_msgSender()];
        require(userStake.rank > 0, 'Mo stake exists');
        require(block.timestamp > userStake.maturityTs, 'Stake maturity not reached');
        // TODO: replace with a decreasing window
        require(userStake.maturityTs + SECONDS_IN_WEEK > block.timestamp, 'Stake withdrawal window passed');
        require(other != address(0), 'Cannot share with zero address');
        require(pct > 0, 'Cannot share zero percent');
        require(pct < 101, 'Cannot share 100+ percent');

        // calculate reward
        uint256 rewardAmount = _calculateReward(userStake.rank, userStake.term, userStake.maturityTs);
        uint256 sharedReward = (rewardAmount * pct) / 100;
        uint256 ownReward = rewardAmount - sharedReward;

        // mint reward tokens
        _mint(_msgSender(), ownReward);
        _mint(other, sharedReward);

        _cleanUpStake(userStake.rank);
        emit Withdrawn(_msgSender(),  rewardAmount);
    }

}

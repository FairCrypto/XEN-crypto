// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8;

import "./Context.sol";
import "./Log.sol";
import "./ERC20.sol";
import "./interfaces/IStakingToken.sol";

contract XENCrypto is
    Context,
    IStakingToken,
    ERC20("XEN Crypto", "XEN")
{

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
        uint256 newMax = MIN_TERM + Log.log2(++activeStakes) * TERM_AMPLIFIER;
        if (newMax > currentMaxTerm && newMax < MAX_TERM_END) {
            currentMaxTerm = newMax;
        }
    }

    function _calculateReward(uint256 userRank, uint256 userTerm)
        private
        view
        returns(uint256)
    {
        uint256 rankDelta = globalRank - userRank;
        return Log.log2(rankDelta) * RANK_AMPLIFIER * userTerm;
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
        // TODO: replace with a decreasing window
        require(userStake.maturityTs + SECONDS_IN_WEEK > block.timestamp, 'Stake withdrawal window passed');

        // calculate reward and mint tokens
        uint256 rewardAmount = _calculateReward(userStake.rank, userStake.term);
        _mint(_msgSender(), rewardAmount);
        // remove stake info
        delete userStakes[_msgSender()];
        delete rankStakes[userStake.rank];
        activeStakes--;
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
        uint256 rewardAmount = _calculateReward(userStake.rank, userStake.term);
        uint256 sharedReward = (rewardAmount * pct) / 100;
        uint256 ownReward = rewardAmount - sharedReward;

        // mint reward tokens
        _mint(_msgSender(), ownReward);
        _mint(other, sharedReward);

        // remove stake info
        delete userStakes[_msgSender()];
        delete rankStakes[userStake.rank];

        activeStakes--;
        emit Withdrawn(_msgSender(),  rewardAmount);
    }

}

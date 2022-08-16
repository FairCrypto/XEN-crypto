// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IRankClaimingToken {

    event RankClaimed(address indexed user, uint256 term, uint256 rank);

    event RankRewardClaimed(address indexed user, uint256 rewardAmount);

    function claimRank(uint256 term) external;

    function claimRankReward() external;

}

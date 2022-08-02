// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8;

interface IStakingToken {

    event Staked(address indexed user, uint256 term, uint256 stakeId);

    event Withdrawn(address indexed user, uint256 stakeId, uint256 rewardAmount);

    function stake(uint256 maturityTs) external;

    function withdraw(uint256 stakeId) external;

}

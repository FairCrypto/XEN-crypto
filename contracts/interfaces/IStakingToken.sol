// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IStakingToken {

    event Staked(address indexed user, uint256 term, uint256 rank);

    event Withdrawn(address indexed user, uint256 rewardAmount);

    function stake(uint256 term) external;

    function withdraw() external;

}

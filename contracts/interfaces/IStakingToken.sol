// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IStakingToken {

    event Staked(address indexed user, uint256 amount, uint256 term);

    event Withdrawn(address indexed user, uint256 amount, uint256 reward);

    function stake(uint256 amount, uint256 term) external;

    function withdraw() external;

}

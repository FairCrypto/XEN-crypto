// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8;

import "./Context.sol";
import "./Ownable.sol";
import "./Pausable.sol";
import "./ReentrancyGuard.sol";
import "./ERC20.sol";
import "./interfaces/IStakingToken.sol";

contract ZeroValueToken is
    Context,
    Ownable,                // TODO: remove if not needed ???
    Pausable,               // TODO: remove if not needed ???
    ReentrancyGuard,        // TODO: remove if not needed ???
    IStakingToken,
    ERC20("Delayed Gratification Coin", "DGC")
{

    // INTERNAL TYPE TO DESCRIBE A STAKE

    struct StakeInfo {
        address user;
        uint256 term;
        uint256 maturityTs;
        uint256 rank;
    }

    uint256 constant public SECONDS_IN_DAY = 3600 * 24;
    uint256 constant public SECONDS_IN_WEEK = 3600 * 24 * 7;
    uint256 constant public GENESIS_RANK = 21;

    // PUBLIC STATE, READABLE VIA NAMESAKE GETTERS

    uint256 public globalRank = GENESIS_RANK;
    uint256 public activeStakes;
    // user address => stake info
    mapping(address => StakeInfo) public userStakes;
    // rank => stake info
    mapping(uint256 => StakeInfo) public rankStakes;

    // INTERNAL METHODS

    function _log2(uint256 x)
        private
        pure
        returns (uint256 y)
    {
        assembly {
            let arg := x
            x := sub(x,1)
            x := or(x, div(x, 0x02))
            x := or(x, div(x, 0x04))
            x := or(x, div(x, 0x10))
            x := or(x, div(x, 0x100))
            x := or(x, div(x, 0x10000))
            x := or(x, div(x, 0x100000000))
            x := or(x, div(x, 0x10000000000000000))
            x := or(x, div(x, 0x100000000000000000000000000000000))
            x := add(x, 1)
            let m := mload(0x40)
            mstore(m,           0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd)
            mstore(add(m,0x20), 0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe)
            mstore(add(m,0x40), 0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616)
            mstore(add(m,0x60), 0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff)
            mstore(add(m,0x80), 0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e)
            mstore(add(m,0xa0), 0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707)
            mstore(add(m,0xc0), 0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606)
            mstore(add(m,0xe0), 0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100)
            mstore(0x40, add(m, 0x100))
            let magic := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
            let shift := 0x100000000000000000000000000000000000000000000000000000000000000
            let a := div(mul(x, magic), shift)
            y := div(mload(add(m,sub(255,a))), shift)
            y := add(y, mul(256, gt(arg, 0x8000000000000000000000000000000000000000000000000000000000000000)))
        }
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
        require(term > 0, 'Maturity shall be in the future');
        require(userStakes[_msgSender()].rank == 0, 'Stake exists');

        // create and store new stakeInfo
        StakeInfo memory stakeInfo = StakeInfo({
            user: _msgSender(),
            term: term,
            maturityTs: block.timestamp + term * SECONDS_IN_DAY,
            rank: globalRank
        });
        userStakes[_msgSender()] = stakeInfo;
        rankStakes[globalRank] = stakeInfo;
        activeStakes++;
        globalRank++;
        emit Staked(_msgSender(), term, globalRank);
    }

    function withdraw()
        external
    {
        StakeInfo memory userStake = userStakes[_msgSender()];
        require(userStake.rank > 0, 'Mo stake exists');
        require(userStake.maturityTs <= block.timestamp, 'Stake maturity not reached');
        require(userStake.maturityTs + SECONDS_IN_WEEK > block.timestamp, 'Stake withdrawal window passed');

        // calculate reward
        uint256 rankDelta = globalRank - userStake.rank;
        uint256 rewardAmount = _log2(rankDelta) * 3000 * userStake.term;
        // mint reward tokens
        _mint(_msgSender(), rewardAmount);
        // remove stake info
        delete userStakes[_msgSender()];
        delete rankStakes[userStake.rank];
        activeStakes--;
        emit Withdrawn(_msgSender(),  rewardAmount);
    }

}

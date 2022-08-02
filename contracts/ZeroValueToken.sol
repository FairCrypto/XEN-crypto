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
    Ownable,
    Pausable,
    ReentrancyGuard,
    IStakingToken,
    ERC20("Delayed Gratification Coin", "DGC")
{

    struct StakeInfo {
        uint256 term;
        uint256 maturityTs;
        uint256 rank;
    }

    uint256 constant public SECONDS_IN_DAY = 3600 * 24;
    uint256 constant public GENESIS_STAKE_ID = 21;

    uint256 public nextStakeId = GENESIS_STAKE_ID;
    uint256 public activeStakes;
    // user address => stake info
    mapping(address => StakeInfo) public userStakes;

    function stake(uint256 term)
        external
    {
        require(term > 0, 'Maturity shall be in the future');
        require(userStakes[_msgSender()].rank == 0, 'Stake exists');

        userStakes[_msgSender()] = StakeInfo({
            term: term,
            maturityTs: block.timestamp + term * SECONDS_IN_DAY,
            rank: nextStakeId
        });

        activeStakes++;
        emit Staked(_msgSender(), term, nextStakeId++);
    }

    function withdraw()
        external
    {
        StakeInfo memory userStake = userStakes[_msgSender()];
        require(userStake.rank > 0, 'Mo stake exists');
        require(userStake.maturityTs <= block.timestamp, 'Stake maturity not reached');

        uint256 rewardAmount = (nextStakeId - userStake.rank) * userStake.term;
        _mint(_msgSender(), rewardAmount);
        delete userStakes[_msgSender()];
        activeStakes--;
        emit Withdrawn(_msgSender(),  rewardAmount);
    }

}

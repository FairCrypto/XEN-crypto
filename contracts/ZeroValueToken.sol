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

    uint256 constant public SECONDS_IN_DAY = 3600 * 24;

    // stake ID => user address
    mapping(uint256 => address) private _stakesById;

    uint256 public nextStakeId = 21;
    uint256 public totalStakes;
    // user address => stake term
    mapping(address => uint256) public stakeTerms;
    // user address => stake maturityTs
    mapping(address => uint256) public userStakes;

    function stake(uint256 term)
        external
    {
        require(term > 0, 'Maturity shall be in the future');
        require(stakeTerms[_msgSender()] == 0 && userStakes[_msgSender()] == 0, 'Stake exists');

        stakeTerms[_msgSender()] = term;
        userStakes[_msgSender()] = block.timestamp + term * SECONDS_IN_DAY;
        _stakesById[nextStakeId++] = _msgSender();
        totalStakes++;
        emit Staked(_msgSender(), term, nextStakeId - 1);
    }

    function withdraw(uint256 stakeId)
        external
    {
        require(stakeId > 0, 'StakeId expected');
        require(_stakesById[stakeId] == _msgSender(), 'Not the Stake owner');
        require(userStakes[_msgSender()] <= block.timestamp, 'Stake maturity not reached');

        uint256 rewardAmount = (nextStakeId - stakeId) * stakeTerms[_msgSender()];
        _mint(_msgSender(), rewardAmount);
        stakeTerms[_msgSender()] = 0;
        userStakes[_msgSender()] = 0;
        totalStakes--;
        emit Withdrawn(_msgSender(), stakeId, rewardAmount);
    }

}

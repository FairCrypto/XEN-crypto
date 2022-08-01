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

    // stake ID => user address
    mapping(uint256 => address) private _stakesById;

    uint256 public nextStakeId = 21;
    // user address => stake term
    mapping(address => uint256) public stakeTerms;
    // user address => stake maturity
    mapping(address => uint256) public userStakes;

    function stake(uint256 maturityBlock)
        external
    {
        require(maturityBlock > block.number, 'Zero term is illegal');
        require(stakeTerms[_msgSender()] == 0, 'Stake exists');
        require(userStakes[_msgSender()] == 0, 'Stake exists');

        stakeTerms[_msgSender()] = maturityBlock - block.number;
        userStakes[_msgSender()] = maturityBlock;
        _stakesById[nextStakeId++] = _msgSender();
        emit Staked(_msgSender(), maturityBlock, nextStakeId - 1);
    }

    function withdraw(uint256 stakeId)
        external
    {
        require(stakeId > 0, 'StakeId expected');
        require(_stakesById[stakeId] == _msgSender(), 'Not the Stake owner');
        require(userStakes[_msgSender()] <= block.number, 'Stake maturity not yet reached');

        uint256 rewardAmount = (nextStakeId - stakeId) * stakeTerms[_msgSender()];
        _mint(_msgSender(), rewardAmount);
        stakeTerms[_msgSender()] = 0;
        userStakes[_msgSender()] = 0;
        emit Withdrawn(_msgSender(), stakeId, rewardAmount);
    }

}

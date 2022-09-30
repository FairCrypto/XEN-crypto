// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "../interfaces/IBurnRedeemable.sol";
import "../interfaces/IBurnableToken.sol";

/**
    This contract implements IBurnRedeemable but reverts in the callback hook
 */
contract RevertingBurner is Context, IBurnRedeemable, IERC165, ERC20("Reverting Burner", "REV") {
    IBurnableToken public xenContract;

    constructor(address _xenContractAddress) {
        xenContract = IBurnableToken(_xenContractAddress);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IBurnRedeemable).interfaceId;
    }

    function exchangeTokens(uint256 amount) external {
        xenContract.burn(_msgSender(), amount);
    }

    function onTokenBurned(address, uint256) public pure {
        revert();
    }
}

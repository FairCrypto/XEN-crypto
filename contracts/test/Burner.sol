// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "../interfaces/IBurnRedeemable.sol";
import "../interfaces/IBurnableToken.sol";

contract Burner is Context, IBurnRedeemable, IERC165, ERC20("Burner", "BURN") {

    IBurnableToken public xenContract;

    constructor(address _xenContractAddress) {
        xenContract = IBurnableToken(_xenContractAddress);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        return interfaceId == type(IBurnRedeemable).interfaceId;
    }

    function exchangeTokens(uint256 amount) external {
        xenContract.burn(_msgSender(), amount);
    }

    function onTokenBurned(address user, uint256 amount) public {
        require(_msgSender() == address(xenContract), 'Burner: wrong caller');
        require(user != address(0), "Burner: zero user address");
        require(amount != 0, "Burner: zero amount");

        _mint(user, amount);
    }


}

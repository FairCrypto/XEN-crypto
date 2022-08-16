// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./interfaces/IERC20.sol";

library ERC20Array {

    function idx(IERC20[] memory arr, address item)
        internal
        pure
        returns (uint256 i)
    {
        for(i = 1; i <= arr.length; i++) {
            if (address(arr[i-1]) == item) {
                return i;
            }
        }
        i = 0;
    }

    function addItem(IERC20[] storage arr, address item)
        internal
    {
        if (idx(arr, item) == 0) {
            arr.push(IERC20(item));
        }
    }

    function removeItem(IERC20[] storage arr, address item)
        internal
    {
        uint i = idx(arr, item);
        if (i > 0) {
            arr[i - 1] = arr[arr.length - 1];
            arr.pop();
        }
    }

    /*
    function contains(address[] memory container, address[] memory items)
        internal
        pure
        returns(bool)
    {
        if (items.length == 0) return true;
        for(uint i = 0; i < items.length; i++) {
            bool itemIsContained = false;
            for(uint j = 0; j < container.length; j++) {
                itemIsContained = items[i] == container[j];
            }
            if (!itemIsContained) return false;
        }
        return true;
    }

    function asSingletonArray(address element)
        internal
        pure
        returns (address[] memory)
    {
        address[] memory array = new address[](1);
        array[0] = element;
        return array;
    }

    function hasDuplicatesOrZeros(address[] memory array)
        internal
        pure
        returns (bool)
    {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == address(0)) return true;
            for (uint j = 0; j < array.length; j++) {
                if (array[i] == array[j] && i != j) return true;
            }
        }
        return false;
    }

    function hasRoguesOrZeros(address[] memory array)
        internal
        pure
        returns (bool)
    {
        address _first = array[0];
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == address(0) || array[i] != _first) return true;
        }
        return false;
    }
    */
}

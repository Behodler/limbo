// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../TokenProxies/CliffFace.sol";
import "../openzeppelin/IERC20.sol";

contract TwoCliffFaceCalls {
  CliffFace immutable cliffFace;

  constructor(address _cliffFace) {
    cliffFace = CliffFace(_cliffFace);
    IERC20(cliffFace.baseToken()).approve(_cliffFace, type(uint256).max);
  }

  function doubleSwapIn(address behodlerToken, uint256 outputAmount) public {
    uint256 swapAmount = 1 ether - 9e14;

    IERC20(cliffFace.baseToken()).transferFrom(msg.sender, address(this), 5 ether);
    cliffFace.swapAsInput(address(this), behodlerToken, outputAmount, swapAmount);
    cliffFace.swapAsInput(address(this), behodlerToken, outputAmount, swapAmount);
  }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../facades/TokenProxyRegistryLike.sol";
import "../../openzeppelin/IERC20.sol";
import "../../facades/BehodlerLike.sol";
import "../../TokenProxies/CliffFace.sol";

contract SwapComparisons {
  struct Dependencies {
    TokenProxyRegistryLike proxyRegistry;
    IERC20 EYE;
    IERC20 DAI;
    BehodlerLike behodler;
    CliffFace cliffFlan;
    IERC20 flan;
  }

  struct Context {
    uint256 outputAmount;
    uint256 gasStamp;
  }
  Context simpleContext;
  Context cliffFaceContext;
  Dependencies DEPS;

  constructor(
    address proxyRegistry,
    address eye,
    address dai,
    address behodler,
    address flan
  ) {
    DEPS.proxyRegistry = TokenProxyRegistryLike(proxyRegistry);
    DEPS.behodler = BehodlerLike(behodler);
    DEPS.EYE = IERC20(eye);
    DEPS.DAI = IERC20(dai);
    (, address behodlerToken) = DEPS.proxyRegistry.tokenProxy(flan);
    DEPS.cliffFlan = CliffFace(behodlerToken);
    DEPS.flan = IERC20(flan);
  }

  function swapMeasureSimpleSwap() public {
    uint256 reserveOut = DEPS.DAI.balanceOf(address(DEPS.behodler));
    uint256 reserveIn = DEPS.EYE.balanceOf(address(DEPS.behodler));
    simpleContext.outputAmount = getAmountOut(1 ether, reserveIn, reserveOut);

    DEPS.EYE.transferFrom(msg.sender, address(this), 10 ether);
    DEPS.EYE.approve(address(DEPS.behodler), 10 ether);

    uint256 gasBefore = gasleft();
    DEPS.behodler.swap(address(DEPS.EYE), address(DEPS.DAI), 1 ether, simpleContext.outputAmount);
    simpleContext.gasStamp = gasBefore - gasleft();
  }

  function swapMeasureCliffFaceSwap() public {
    uint256 reserveOut = DEPS.DAI.balanceOf(address(DEPS.behodler));
    uint256 reserveIn = DEPS.cliffFlan.balanceOf(address(DEPS.behodler));
    cliffFaceContext.outputAmount = getAmountOut(1 ether, reserveIn, reserveOut);
    DEPS.flan.transferFrom(msg.sender, address(this), 1 ether);
    DEPS.flan.approve(address(DEPS.cliffFlan), type(uint256).max);
    DEPS.cliffFlan.approveBehodlerFor(address(DEPS.cliffFlan));
    uint256 gasBefore = gasleft();

    DEPS.cliffFlan.swapAsInput(address(this), address(DEPS.DAI), cliffFaceContext.outputAmount, 1 ether);
    cliffFaceContext.gasStamp = gasBefore - gasleft();
  }

  function getAmountOut(
    uint256 amountIn,
    uint256 reserveIn,
    uint256 reserveOut
  ) internal pure returns (uint256 amountOut) {
    uint256 amountInWithFee = amountIn * 995;
    uint256 numerator = amountInWithFee * reserveOut;
    uint256 denominator = (reserveIn * 1000) + amountInWithFee;
    amountOut = numerator / denominator;
  }

  function gasConsumed(bool simple) public view virtual returns (uint256) {
    return simple ? simpleContext.gasStamp : cliffFaceContext.gasStamp;
  }
}

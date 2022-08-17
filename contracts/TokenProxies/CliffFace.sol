// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "./BehodlerTokenProxy.sol";
import "../openzeppelin/ERC20Burnable.sol";
import "../openzeppelin/SafeERC20.sol";
import "../periphery/Errors.sol";

///@title Cliff Face
///@author Justin Goro
/**@notice This special proxy is designed to protect Behodler from either tokens that hyperinflate
 * or tokens which suddenly crash in value (aka Sh*tcoins). Both pose a risk to the AMM by draining liquidity in a process
 * traditional AMMs refer to as impermanent loss. The side effect of making use of this proxy is that it automatically
 * insulates Scarcity from impermanent loss without curbing the upside of liquidity growth.
 * The concept is simple. If the quantity minted increases too fast, the marginal redeem rate escalates, pushing up the average redeem rate.
 * For the end user, the person dumping the token into Behdodler, they'll experience an unusually high slippage. Essentially the dumpers absorb the full impact of the price decline
 * without passing on the contagion to Behodler. This proxy will allow LimboDAO to relax restrictions on the types of new tokens listed,
 * indirectly increasing the HOLD value for EYE.
 */
///@dev Current uncommented mint makes the slippage rise in proportion with shitcoin falling below $1. TODO: simulations
contract CliffFace is BehodlerTokenProxy {
  using SafeERC20 for IERC20;

  address public immutable referenceToken;
  uint256 public immutable referenceMultiple;
  struct Variables {
    uint256 priorRefBalance;
    uint256 blockNumber;
    uint256 thisBalance;
  }

  Variables VARS;

  constructor(
    address _baseToken,
    string memory name_,
    string memory symbol_,
    address registry,
    address _referenceToken,
    uint256 multiple,
    address _behodler, 
    uint _initalRedeemRate
  ) BehodlerTokenProxy(_behodler, _baseToken, name_, symbol_, registry, _initalRedeemRate) {
    referenceToken = _referenceToken;
    referenceMultiple = multiple;
    VARS.priorRefBalance = IERC20(referenceToken).balanceOf(behodler);
    VARS.blockNumber = block.number;
  }

  function seedBehodler(uint256 initialSupply, address scxDestination) public override {
    uint256 amount = mint(initialRedeemRate, address(this), msg.sender, initialSupply);

    _approve(address(this), behodler, type(uint256).max);
    uint256 scx = BehodlerLike(behodler).addLiquidity(address(this), amount);
    BehodlerLike(behodler).transfer(scxDestination, scx);
    VARS.priorRefBalance = IERC20(referenceToken).balanceOf(behodler);
    VARS.thisBalance = IERC20(address(this)).balanceOf(behodler);
  }

  ///@dev so that this isn't performed on every call to swap out
  function approveBehodlerFor(address inputToken) public {
    IERC20(inputToken).safeApprove(behodler, type(uint256).max);
  }

  struct SwapAsInputWorkingVARS {
    uint256 currentRefBalance;
    uint256 currentThisBalance;
    uint256 R_AMP;
    uint256 minted;
  }

  function swapAsInput(
    address outputRecipient,
    address outputToken,
    uint256 outputAmount,
    uint256 baseTokenAmount
  ) public override returns (bool) {
    Variables memory localVars = VARS;
    SwapAsInputWorkingVARS memory workingVars;
    if (block.number == VARS.blockNumber) {
      revert SlippageManipulationPrevention(block.number, VARS.blockNumber);
    }
    //gather balances before swap
    workingVars.currentRefBalance = IERC20(behodler).balanceOf(referenceToken);
    workingVars.currentThisBalance = IERC20(address(this)).balanceOf(behodler);

    workingVars.R_AMP = initialRedeemRate;

    if ((baseTokenAmount + localVars.thisBalance) * initialRedeemRate > localVars.priorRefBalance * referenceMultiple) {
      workingVars.R_AMP =
        ((baseTokenAmount + localVars.thisBalance) * (initialRedeemRate**2)) /
        (localVars.priorRefBalance * referenceMultiple);
    }
    workingVars.minted = mint(workingVars.R_AMP, address(this), msg.sender, baseTokenAmount);

    if (outputToken == behodler) {
      uint256 scx = BehodlerLike(behodler).addLiquidity(address(this), workingVars.minted);
      if (scx != outputAmount) {
        //scx addition susceptible to sandwich attacks without this
        revert BehodlerSwapInInvariantViolated(scx, outputAmount);
      }
      BehodlerLike(behodler).transfer(outputRecipient, scx);
    } else {
      BehodlerLike(behodler).swap(address(this), outputToken, workingVars.minted, outputAmount);
      IERC20(baseToken).safeTransfer(outputRecipient, outputAmount);
    }
    //modifiers don't share local variables according to a compiler error :(
    localVars.priorRefBalance = workingVars.currentRefBalance;
    localVars.blockNumber = block.number;
    localVars.thisBalance = workingVars.currentThisBalance;
    VARS = localVars;
    return true;
  }

  ///@dev UI dev will need to convert base tokens entered by user to proxyTokensTorRelease

  function swapAsOuput(
    address outputRecipient,
    address input,
    uint256 proxyTokensToRelease,
    uint256 expectedInputAmount
  ) public override returns (bool) {
    IERC20(input).transferFrom(msg.sender, address(this), expectedInputAmount);

    //withdraw liquidity
    if (input == behodler) {
      uint256 scx = BehodlerLike(behodler).withdrawLiquidity(address(this), (proxyTokensToRelease));
      //withdrawing SCX with cliffFace proxy protects against sandwich attacks
      //drop 10 bits to account for discrepencies between EVM and front end
      if (scx > 1024 && scx >> 10 > expectedInputAmount >> 10) {
        revert BehodlerSwapOutInvariantViolated(input, scx, expectedInputAmount);
      }
    } else {
      uint256 baseTokensToRelease = (proxyTokensToRelease * redeemRate()) / initialRedeemRate;
      BehodlerLike(behodler).swap(input, address(this), expectedInputAmount, proxyTokensToRelease);
      uint256 actualBase = redeem(address(this), outputRecipient, proxyTokensToRelease);
      if (baseTokensToRelease >> 10 < actualBase >> 10) {
        revert BehodlerSwapOutInvariantViolated(input, baseTokensToRelease, actualBase);
      }
    }
    return true;
  }
}

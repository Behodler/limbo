// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../../../openzeppelin/Ownable.sol";
import "../../../openzeppelin/IERC20.sol";
import "./WETH10.sol";
import "../../../facades/LachesisLike.sol";
import "../../../facades/Burnable.sol";
import "../../../facades/FlashLoanArbiterLike.sol";
import "hardhat/console.sol";
/*
    Scarcity is the bonding curve token that underpins Behodler functionality
    Scarcity burns on transfer and also exacts a fee outside of Behodler.
 */
contract Scarcity is IERC20, Ownable {
  bool public constant REAL = true;
  event Mint(address sender, address recipient, uint256 value);
  event Burn(uint256 value);

  mapping(address => uint256) internal balances;
  mapping(address => mapping(address => uint256)) internal _allowances;
  uint256 internal _totalSupply;
  address public migrator;

  struct BurnConfig {
    uint256 transferFee; // percentage expressed as number betewen 1 and 1000
    uint256 burnFee; // percentage expressed as number betewen 1 and 1000
    address feeDestination;
  }

  BurnConfig public config;

  function configureScarcity(
    uint256 transferFee,
    uint256 burnFee,
    address feeDestination
  ) public onlyOwner {
    require(config.transferFee + config.burnFee < 1000);
    config.transferFee = transferFee;
    config.burnFee = burnFee;
    config.feeDestination = feeDestination;
  }

  function getConfiguration()
    public
    view
    returns (
      uint256,
      uint256,
      address
    )
  {
    return (config.transferFee, config.burnFee, config.feeDestination);
  }

  function setMigrator(address m) public onlyOwner {
    migrator = m;
  }

  function name() public pure returns (string memory) {
    return "Scarcity";
  }

  function symbol() public pure returns (string memory) {
    return "SCX";
  }

  function decimals() public pure returns (uint8) {
    return 18;
  }

  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) external view override returns (uint256) {
    return balances[account];
  }

  function transfer(address recipient, uint256 amount) external override returns (bool) {
    _transfer(msg.sender, recipient, amount);
    return true;
  }

  function allowance(address owner, address spender) external view override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external override returns (bool) {
    _transfer(sender, recipient, amount);
    _approve(sender, msg.sender, _allowances[sender][msg.sender] - amount);
    return true;
  }

  function burn(uint256 value) external returns (bool) {
    burn(msg.sender, value);
    return true;
  }

  function burn(address holder, uint256 value) internal {
    balances[holder] = balances[holder] - value;
    _totalSupply = _totalSupply - value;
    emit Burn(value);
  }

  function mint(address recipient, uint256 value) internal {
    balances[recipient] = balances[recipient] + value;
    _totalSupply = _totalSupply + value;
    emit Mint(msg.sender, recipient, value);
  }

  function migrateMint(address recipient, uint256 value) public {
    require(msg.sender == migrator, "SCARCITY: Migration contract only");
    mint(recipient, value);
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), "ERC20: approve from the zero address");
    require(spender != address(0), "ERC20: approve to the zero address");

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  //outside of Behodler, Scarcity transfer incurs a fee.
  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), "Scarcity: transfer from the zero address");
    require(recipient != address(0), "Scarcity: transfer to the zero address");

    uint256 feeComponent = (config.transferFee * amount) / 1000;
    uint256 burnComponent = (config.burnFee * amount) / 1000;
    _totalSupply = _totalSupply - burnComponent;
    emit Burn(burnComponent);

    balances[config.feeDestination] = balances[config.feeDestination] + feeComponent;

    balances[sender] = balances[sender] - amount;

    balances[recipient] = balances[recipient] + amount - (feeComponent + burnComponent);
    emit Transfer(sender, recipient, amount);
  }

  function applyBurnFee(
    address token,
    uint256 amount,
    bool proxyBurn
  ) internal returns (uint256) {
    uint256 burnAmount = (config.burnFee * amount) / 1000;
    Burnable bToken = Burnable(token);
    if (proxyBurn) {
      bToken.burn(address(this), burnAmount);
    } else {
      bToken.burn(burnAmount);
    }

    return burnAmount;
  }
}

abstract contract FlashLoanReceiver {
  function execute(address caller) public virtual;
}

library AddressBalanceCheck {
  function tokenBalance(address token) public view returns (uint256) {
    return IERC20(token).balanceOf(address(this));
  }

  function shiftedBalance(address token, uint256 factor) public view returns (uint256) {
    return IERC20(token).balanceOf(address(this)) / factor;
  }

  function transferIn(
    address token,
    address sender,
    uint256 value
  ) public {
    IERC20(token).transferFrom(sender, address(this), value);
  }

  function transferOut(
    address token,
    address recipient,
    uint256 value
  ) public {
    IERC20(token).transfer(recipient, value);
  }
}

/*To following code is sourced from the ABDK library for assistance in dealing with precision logarithms in Ethereum.
 * ABDK Math 64.64 Smart Contract Library.  Copyright © 2019 by ABDK Consulting.
 * Author: Mikhail Vladimirov <mikhail.vladimirov@gmail.com>
 * Source: https://github.com/abdk-consulting/abdk-libraries-solidity/blob/master/ABDKMath64x64.sol#L366
 */
library ABDK {
  /*
   * Minimum value signed 64.64-bit fixed point number may have.
   */
  int128 private constant MIN_64x64 = -0x80000000000000000000000000000000;

  /*
   * Maximum value signed 64.64-bit fixed point number may have.
   */
  int128 private constant MAX_64x64 = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /**
   * Convert unsigned 256-bit integer number into signed 64.64-bit fixed point
   * number.  Revert on overflow.
   *
   * @param x unsigned 256-bit integer number
   * @return signed 64.64-bit fixed point number
   */
  function fromUInt(uint256 x) internal pure returns (int128) {
    require(x <= 0x7FFFFFFFFFFFFFFF);
    return int128(uint128(x << 64));
  }

  /**
   * Calculate x + y.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function add(int128 x, int128 y) internal pure returns (int128) {
    int256 result = int256(x) + y;
    require(result >= MIN_64x64 && result <= MAX_64x64);
    return int128(result);
  }

  /**
   * Calculate binary logarithm of x.  Revert if x <= 0.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function log_2(uint256 x) internal pure returns (uint256) {
    require(x > 0);

    uint256 msb = 0;
    uint256 xc = x;
    if (xc >= 0x10000000000000000) {
      xc >>= 64;
      msb += 64;
    }
    if (xc >= 0x100000000) {
      xc >>= 32;
      msb += 32;
    }
    if (xc >= 0x10000) {
      xc >>= 16;
      msb += 16;
    }
    if (xc >= 0x100) {
      xc >>= 8;
      msb += 8;
    }
    if (xc >= 0x10) {
      xc >>= 4;
      msb += 4;
    }
    if (xc >= 0x4) {
      xc >>= 2;
      msb += 2;
    }
    if (xc >= 0x2) msb += 1; // No need to shift xc anymore

    uint256 result = (msb - 64) << 64;
    uint256 ux = uint256(x) << uint256(127 - msb);
    for (uint256 bit = 0x8000000000000000; bit > 0; bit >>= 1) {
      ux *= ux;
      uint256 b = ux >> 255;
      ux >>= 127 + b;
      result += bit * b;
    }

    return result;
  }
}

contract Behodler is Scarcity {
  using ABDK for int128;
  using ABDK for uint256;
  using AddressBalanceCheck for address;

  event LiquidityAdded(address sender, address token, uint256 tokenValue, uint256 scx);
  event LiquidityWithdrawn(address recipient, address token, uint256 tokenValue, uint256 scx);
  event Swap(address sender, address inputToken, address outputToken, uint256 inputValue, uint256 outputValue);

  struct WeidaiTokens {
    address dai;
    address reserve;
    address weiDai;
  }

  struct PrecisionFactors {
    uint8 swapPrecisionFactor;
    uint8 maxLiquidityExit; //percentage as number between 1 and 100
  }

  WeidaiTokens WD;
  PrecisionFactors safetyParameters;
  address public Weth;
  address public Lachesis;
  address pyroTokenLiquidityReceiver;
  FlashLoanArbiterLike public arbiter;
  address private inputSender;
  bool[3] unlocked;

  constructor() {
    safetyParameters.swapPrecisionFactor = 30; //approximately a billion
    safetyParameters.maxLiquidityExit = 90;
    for (uint8 i = 0; i < 3; i++) unlocked[i] = true;
  }

  function setSafetParameters(uint8 swapPrecisionFactor, uint8 maxLiquidityExit) external onlyOwner {
    safetyParameters.swapPrecisionFactor = swapPrecisionFactor;
    safetyParameters.maxLiquidityExit = maxLiquidityExit;
  }

  function getMaxLiquidityExit() public view returns (uint8) {
    return safetyParameters.maxLiquidityExit;
  }

  function seed(
    address weth,
    address lachesis,
    address flashLoanArbiter,
    address _pyroTokenLiquidityReceiver,
    address weidaiReserve,
    address dai,
    address weiDai
  ) external onlyOwner {
    Weth = weth;
    Lachesis = lachesis;
    arbiter = FlashLoanArbiterLike(flashLoanArbiter);
    pyroTokenLiquidityReceiver = _pyroTokenLiquidityReceiver;
    WD.reserve = weidaiReserve;
    WD.dai = dai;
    WD.weiDai = weiDai;
  }

  //Logarithmic growth can get quite flat beyond the first chunk. We divide input amounts by
  uint256 public constant MIN_LIQUIDITY = 1e12;

  mapping(address => bool) public tokenBurnable;
  mapping(address => bool) public validTokens;
  mapping(address => bool) public whiteListUsers; // can trade on tokens that are disabled

  modifier onlyLachesis() {
    require(msg.sender == Lachesis);
    _;
  }

  modifier onlyValidToken(address token) {
    require(
      whiteListUsers[msg.sender] || validTokens[token] || (token != address(0) && token == Weth),
      "BEHODLER: token invalid"
    );
    _;
  }

  modifier determineSender(address inputToken) {
    if (msg.value > 0) {
      require(inputToken == Weth, "BEHODLER: Eth only valid for Weth trades.");
      inputSender = address(this);
    } else {
      inputSender = msg.sender;
    }
    _;
  }

  enum Slot {
    Swap,
    Add,
    Withdraw
  }

  modifier lock(Slot slot) {
    uint256 index = uint256(slot);
    require(unlocked[index], "BEHODLER: Reentrancy guard active.");
    unlocked[index] = false;
    _;
    unlocked[index] = true;
  }

  /*
   Let config.burnFee be b.
    Let F = 1-b
    Let input token be I and Output token be O
    _i is initial and _f is final. Eg. I_i is initial input token balance
    The swap equation, when simplified, is given by
    √F(√I_f - √I_i) = (√O_i - √O_f)/(F)
    However, the gradient of square root becomes untenable when
    the value of tokens diverge too much. The gradient favours the addition of low
    value tokens disportionately. A gradient that favours tokens equally is given by
    a log. The lowest gas implementation is base 2.
    The new swap equation is thus
    log(I_f) - log(I_i) = log(O_i) - log(O_f)

    Technical note on ETH handling: we don't duplicate functions for accepting Eth as an input. Instead we wrap on receipt
    and apply a reentrancy guard. The determineSender modifier fixes an isse in Behodler 1 which required the user to approve
    both sending and receiving Eth because of the nature of Weth deposit and withdraw functionality.
 */
  function swap(
    address inputToken,
    address outputToken,
    uint256 inputAmount,
    uint256 outputAmount
  ) external payable determineSender(inputToken) onlyValidToken(inputToken) lock(Slot.Swap) returns (bool success) {
    uint256 initialInputBalance = inputToken.tokenBalance();
    if (inputToken == Weth) {
      if (IERC20(Weth).balanceOf(msg.sender) >= inputAmount) {
        Weth.transferIn(msg.sender, inputAmount);
      } else {
        require(msg.value == inputAmount, "BEHODLER: Insufficient Ether sent");
        IWETH10(Weth).deposit{value: msg.value}();
      }
    } else {
      inputToken.transferIn(inputSender, inputAmount);
    }
    uint256 netInputAmount = inputAmount - burnToken(inputToken, inputAmount);
    uint256 initialOutputBalance = outputToken.tokenBalance();
    require(
      (outputAmount * 100) / initialOutputBalance <= safetyParameters.maxLiquidityExit,
      "BEHODLER: liquidity withdrawal too large."
    );
    uint256 finalInputBalance = initialInputBalance + netInputAmount;
    uint256 finalOutputBalance = initialOutputBalance - outputAmount;

    //new scope to avoid stack too deep errors.
    {
      //if the input balance after adding input liquidity is 1073741824 bigger than the initial balance, we revert.
      uint256 inputRatio = (initialInputBalance << safetyParameters.swapPrecisionFactor) / finalInputBalance;
      uint256 outputRatio = (finalOutputBalance << safetyParameters.swapPrecisionFactor) / initialOutputBalance;
      require(inputRatio != 0 && inputRatio == outputRatio, "BEHODLER: swap invariant.");
    }

    require(finalOutputBalance >= MIN_LIQUIDITY, "BEHODLER: min liquidity.");
    if (outputToken == Weth) {
      address payable sender = payable(msg.sender);
      IWETH10(Weth).withdrawTo(sender, outputAmount);
    } else {
      outputToken.transferOut(msg.sender, outputAmount);
    }

    emit Swap(msg.sender, inputToken, outputToken, inputAmount, outputAmount);
    success = true;
  }

  /*
        ΔSCX = log(FinalBalance) - log(InitialBalance)

        The choice of base for the log isn't relevant from a mathematical point of view
        but from a computational point of view, base 2 is the cheapest for obvious reasons.
        "What I told you was true, from a certain point of view." - Obi-Wan Kenobi
     */
  function addLiquidity(address inputToken, uint256 amount)
    external
    payable
    determineSender(inputToken)
    onlyValidToken(inputToken)
    lock(Slot.Add)
    returns (uint256 deltaSCX)
  {
    uint256 initialBalance = uint256(uint128(inputToken.shiftedBalance(MIN_LIQUIDITY).fromUInt()));
    if (inputToken == Weth) {
      if (IERC20(Weth).balanceOf(msg.sender) >= amount) {
        Weth.transferIn(msg.sender, amount);
      } else {
        require(msg.value == amount, "BEHODLER: Insufficient Ether sent");
        IWETH10(Weth).deposit{value: msg.value}();
      }
    } else {
      inputToken.transferIn(inputSender, amount);
    }
    uint256 netInputAmount = uint256(uint128(((amount - burnToken(inputToken, amount)) / MIN_LIQUIDITY).fromUInt()));
    uint256 finalBalance = initialBalance + netInputAmount;
    require(uint256(finalBalance) >= MIN_LIQUIDITY, "BEHODLER: min liquidity.");
    deltaSCX = uint256(finalBalance.log_2() - (initialBalance > 1 ? initialBalance.log_2() : 0));
    mint(msg.sender, deltaSCX);
    emit LiquidityAdded(msg.sender, inputToken, amount, deltaSCX);
  }

  /*
        ΔSCX =  log(InitialBalance) - log(FinalBalance)
        tokensToRelease = InitialBalance -FinalBalance
        =>FinalBalance =  InitialBalance - tokensToRelease
        Then apply logs and deduct SCX from msg.sender

        The choice of base for the log isn't relevant from a mathematical point of view
        but from a computational point of view, base 2 is the cheapest for obvious reasons.
        "From my point of view, the Jedi are evil" - Darth Vader
     */
  function withdrawLiquidity(address outputToken, uint256 tokensToRelease)
    external
    payable
    determineSender(outputToken)
    onlyValidToken(outputToken)
    lock(Slot.Withdraw)
    returns (uint256 deltaSCX)
  {
    uint256 initialBalance = outputToken.tokenBalance();
    uint256 finalBalance = initialBalance - tokensToRelease;
    require(finalBalance > MIN_LIQUIDITY, "BEHODLER: min liquidity");
    require(
      (tokensToRelease * 100) / initialBalance <= safetyParameters.maxLiquidityExit,
      "BEHODLER: liquidity withdrawal too large."
    );

    uint256 logInitial = initialBalance.log_2();
    uint256 logFinal = finalBalance.log_2();

    deltaSCX = logInitial - (finalBalance > 1 ? logFinal : 0);
    uint256 scxBalance = balances[msg.sender];

    if (deltaSCX > scxBalance) {
      //rounding errors in scx creation and destruction. Err on the side of holders
      uint256 difference = deltaSCX - scxBalance;
      if ((difference * 10000) / deltaSCX == 0) deltaSCX = scxBalance;
    }
    burn(msg.sender, deltaSCX);

    if (outputToken == Weth) {
      address payable sender = payable(msg.sender);
      IWETH10(Weth).withdrawTo(sender, tokensToRelease);
    } else {
      outputToken.transferOut(msg.sender, tokensToRelease);
    }
    emit LiquidityWithdrawn(msg.sender, outputToken, tokensToRelease, deltaSCX);
  }

  /*
        ΔSCX =  log(InitialBalance) - log(FinalBalance)
        tokensToRelease = InitialBalance -FinalBalance
        =>FinalBalance =  InitialBalance - tokensToRelease
        Then apply logs and deduct SCX from msg.sender

        The choice of base for the log isn't relevant from a mathematical point of view
        but from a computational point of view, base 2 is the cheapest for obvious reasons.
        "From my point of view, the Jedi are evil" - Darth Vader
     */
  function withdrawLiquidityFindSCX(
    address outputToken,
    uint256 tokensToRelease,
    uint256 scx,
    uint256 passes
  ) external view returns (uint256) {
    uint256 upperBoundary = outputToken.tokenBalance();
    uint256 lowerBoundary = 0;

    for (uint256 i = 0; i < passes; i++) {
      uint256 initialBalance = outputToken.tokenBalance();
      uint256 finalBalance = initialBalance - tokensToRelease;

      uint256 logInitial = initialBalance.log_2();
      uint256 logFinal = finalBalance.log_2();

      int256 deltaSCX = int256(logInitial - (finalBalance > 1 ? logFinal : 0));
      int256 difference = int256(scx) - deltaSCX;
      // if (difference**2 < 1000000) return tokensToRelease;
      if (difference == 0) return tokensToRelease;
      if (difference < 0) {
        // too many tokens requested
        upperBoundary = tokensToRelease - 1;
      } else {
        //too few tokens requested
        lowerBoundary = tokensToRelease + 1;
      }
      tokensToRelease = ((upperBoundary - lowerBoundary) / 2) + lowerBoundary; //bitshift
      tokensToRelease = tokensToRelease > initialBalance ? initialBalance : tokensToRelease;
    }
    return tokensToRelease;
  }

  //TODO: possibly comply with the flash loan standard https://eips.ethereum.org/EIPS/eip-3156
  // - however, the more I reflect on this, the less keen I am due to gas and simplicity
  //example: a user must hold 10% of SCX total supply or user must hold an NFT
  //The initial arbiter will have no constraints.
  //The flashloan system on behodler is inverted. Instead of being able to borrow any individual token,
  //the borrower asks for SCX. Theoretically you can borrow more SCX than currently exists so long
  //as you can think of a clever way to pay it back.
  //Note: Borrower doesn't have to send scarcity back, they just need to have high enough balance.
  function grantFlashLoan(uint256 amount, address flashLoanContract) external {
    require(arbiter.canBorrow(msg.sender), "BEHODLER: cannot borrow flashloan");
    balances[flashLoanContract] = balances[flashLoanContract] + amount;
    FlashLoanReceiver(flashLoanContract).execute(msg.sender);
    balances[flashLoanContract] = balances[flashLoanContract] - amount;
  }

  //useful for when we want the ability to add tokens without trading. For instance, the initial liquidity queueing event.
  function setWhiteListUser(address user, bool whiteList) external onlyOwner {
    whiteListUsers[user] = whiteList;
  }

  function burnToken(address token, uint256 amount) private returns (uint256 burnt) {
    if (token == WD.weiDai) {
      burnt = applyBurnFee(token, amount, true);
    } else if (tokenBurnable[token]) burnt = applyBurnFee(token, amount, false);
    else if (token == WD.dai) {
      burnt = (config.burnFee - amount) / 1000;
      token.transferOut(WD.reserve, burnt);
    } else {
      burnt = (config.burnFee * amount) / 1000;
      token.transferOut(pyroTokenLiquidityReceiver, burnt);
    }
  }

  function setValidToken(
    address token,
    bool valid,
    bool burnable
  ) external onlyLachesis {
    validTokens[token] = valid;
    tokenBurnable[token] = burnable;
  }
}

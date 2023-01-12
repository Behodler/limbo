// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../openzeppelin/IERC20.sol";
import "../facades/BehodlerLike.sol";
import "../facades/LiquidityReceiverNewLike.sol";

contract RegisterPyroTokenV3Power is PowerInvoker, Empowered {
  address token;
  bool burnable;
  address rewardContract;
  struct PyroDetails {
    string name;
    string symbol;
  }

  PyroDetails pyro;

  constructor(
    address _token,
    bool _burnable,
    address _angband
  ) PowerInvoker("REGISTER_PYRO_V3", _angband) {
    token = _token;
    burnable = _burnable;
  }

  //optional
  function setPyroDetails(string memory name, string memory symbol) public requiresPower("ADD_TOKEN_TO_BEHODLER") {
    pyro.name = name;
    pyro.symbol = symbol;
  }

  function orchestrate() internal override returns (bool) {
    LiquidityReceiverNewLike LR = LiquidityReceiverNewLike(angband.getAddress(power.domain));
    if (!burnable) {
      LR.registerPyroToken(token, pyro.name, pyro.symbol, 18);
    }
    return true;
  }
}

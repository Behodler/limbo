// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../openzeppelin/IERC20.sol";
import "./Pyrotoken.sol";
import "./Lachesis.sol";
import "../../../openzeppelin/Ownable.sol";

contract LiquidityReceiverV1 is Ownable {
  bool public constant REAL = true;
  Lachesis lachesis;
  mapping(address => address) public baseTokenMapping;

  constructor(address _lachesis) {
    lachesis = Lachesis(_lachesis);
  }

  function setLachesis(address _lachesis) public onlyOwner {
    lachesis = Lachesis(_lachesis);
  }

  function registerPyroToken(address baseToken) public {
    require(baseTokenMapping[baseToken] == address(0), "BEHODLER: pyrotoken already registered");
    (bool valid, bool burnable) = lachesis.cut(baseToken);
    require(valid && !burnable, "invalid pyrotoken registration.");
    Pyrotoken pyro = new Pyrotoken(baseToken, address(this));
    baseTokenMapping[baseToken] = address(pyro);
  }

  function drain(address pyroToken) public {
    address baseToken = Pyrotoken(pyroToken).baseToken();
    require(baseTokenMapping[baseToken] == pyroToken, "BEHODLER: pyrotoken not registered.");
    address self = address(this);
    uint256 balance = IERC20(baseToken).balanceOf(self);
    IERC20(baseToken).transfer(pyroToken, balance);
  }
}

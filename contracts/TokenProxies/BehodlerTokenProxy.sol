// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "./TokenProxyBase.sol";
import "../facades/BehodlerLike.sol";

abstract contract BehodlerTokenProxy is TokenProxyBase {
  constructor(
    address _behodler,
    address _baseToken,
    string memory name_,
    string memory symbol_,
    address registry,
    uint initialRedeemRate
  ) TokenProxyBase(_baseToken, name_, symbol_, registry,initialRedeemRate) {
    behodler = _behodler;
  }

  //behodler mainnet address
  address internal immutable behodler;

  ///@dev For a behodler front end, detect proxy and call this instead of regular behodler functions
  ///@param outputToken token to buy. SCX address means mint
  function swapAsInput(
    address outputRecipient,
    address outputToken,
    uint256 outputAmount,
    uint256 baseTokenAmount
  ) public virtual returns (bool);

  function swapAsOuput(
    address outputRecipient,
    address input,
    uint256 proxyTokensToRelease,
    uint256 expectedInputAmount
  ) public virtual returns (bool);

  ///@dev call this after approving on Lachesis
  ///@param initialSupply the amount used to preseed Behodler.
  function seedBehodler(uint256 initialSupply) public virtual;
}

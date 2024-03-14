// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../facades/LachesisLike.sol";

contract RefreshTokenOnBehodler is PowerInvoker, Ownable_071 {
  address[] tokensToRefresh;

  constructor(address _angband) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
   
  }

  function addToken(address token) public onlyOwner {
    tokensToRefresh.push(token);
  }

  function orchestrate() internal override returns (bool) {
    LachesisLike_071 lachesis = LachesisLike_071(angband.getAddress(power.domain));
    for (uint256 i = 0; i < tokensToRefresh.length; i++) {
      lachesis.updateBehodler(tokensToRefresh[i]);
    }
    return true;
  }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../openzeppelin/Ownable.sol";
import "../../../facades/LachesisLike.sol";
import "../../../facades/BehodlerLike.sol";

abstract contract FactoryFacade {
  mapping(address => mapping(address => address)) public getPair;
}

contract Lachesis is Ownable, LachesisLike {
  bool public constant REAL = true;
  struct tokenConfig {
    bool valid;
    bool burnable;
  }
  address public behodler;
  mapping(address => tokenConfig) private config;

  struct Factory {
    FactoryFacade uni;
    FactoryFacade sushi;
  }
  Factory swapFactory;

  constructor(address uniswapFactory, address sushiSwapFactory) {
    swapFactory.uni = FactoryFacade(uniswapFactory);
    swapFactory.sushi = FactoryFacade(sushiSwapFactory);
  }

  function cut(address token) public view override returns (bool, bool) {
    tokenConfig memory parameters = config[token];
    return (parameters.valid, parameters.burnable);
  }

  function measure(
    address token,
    bool valid,
    bool burnable
  ) public override onlyOwner {
    _measure(token, valid, burnable);
  }

  function _measure(
    address token,
    bool valid,
    bool burnable
  ) internal {
    config[token] = tokenConfig({valid: valid, burnable: burnable});
  }

  function measureLP(address token1, address token2) public onlyOwner {
    require(config[token1].valid && config[token2].valid, "LACHESIS: Only valid tokens can have their LP added");
    address uniswapLP = swapFactory.uni.getPair(token1, token2);
    address sushiswapLP = swapFactory.sushi.getPair(token1, token2);
    if (uniswapLP != address(0)) _measure(uniswapLP, true, false);
    else if (sushiswapLP != address(0)) _measure(sushiswapLP, true, false);
    else revert("LACHESIS: LP token not found.");
  }

  function setBehodler(address b) public override onlyOwner {
    behodler = b;
  }

  function updateBehodler(address token) public override onlyOwner {
    (bool valid, bool burnable) = cut(token);
    BehodlerLike(behodler).setValidToken(token, valid, burnable);
  }
}

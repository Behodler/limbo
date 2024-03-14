// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "./IdempotentPowerInvoker.sol";
import "../facades/BehodlerLike.sol";
import "../behodlerPowers/ConfigureScarcityPower.sol";
import "../facades/TokenProxyRegistryLike_071.sol";
import "../facades/TokenProxyBaseLike_071.sol";
import "../facades/LachesisLike.sol";
import "../openzeppelin/IERC20.sol";

contract LimboAddTokenToBehodler is IdempotentPowerInvoker {
  struct Parameters {
    address soul;
    bool burnable;
    address limbo;
    address tokenProxyRegistry;
  }

  address Scarcity;
  LachesisLike_071 lachesis;
  Parameters public params;
  bytes constant baseTokenCall = abi.encodeWithSignature("baseToken()");

  constructor(
    address _angband,
    address limbo,
    address proxyRegistry,
    address _lachesis,
    address scarcity
  ) IdempotentPowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
    params.limbo = limbo;
    params.tokenProxyRegistry = proxyRegistry;

    lachesis = LachesisLike_071(_lachesis);
    Scarcity = scarcity;
  }

  function parameterize(address soul, bool burnable) public {
    require(msg.sender == params.limbo, "MORGOTH: Only Limbo can migrate tokens from Limbo.");
    params.soul = soul;
    params.burnable = burnable;
  }

  function orchestrate() internal override returns (bool) {
    Parameters memory localParams = params;
    require(localParams.soul != address(0), "MORGOTH: PowerInvokerTest not parameterized.");
    TokenProxyRegistryLike_071 proxyRegistry = TokenProxyRegistryLike_071(localParams.tokenProxyRegistry);

    address baseToken = localParams.soul;
    (bool success, bytes memory data) = baseToken.call(baseTokenCall);

    if (success) {
      baseToken = abi.decode(data, (address));
    }

    (, address behodlerProxy) = proxyRegistry.tokenProxy(baseToken);
    address tokenToRegister = behodlerProxy == address(0) ? baseToken : behodlerProxy;
    lachesis.measure(tokenToRegister, true, localParams.burnable);
    lachesis.updateBehodler(tokenToRegister);
    uint256 balanceOfToken = IERC20_071(localParams.soul).balanceOf(address(this));
    require(balanceOfToken > 0, "MORGOTH: remember to seed contract");
    IERC20_071(localParams.soul).transfer(address(localParams.tokenProxyRegistry), balanceOfToken);
    proxyRegistry.TransferFromLimboTokenToBehodlerToken(localParams.soul);

    uint256 scxBal = IERC20_071(Scarcity).balanceOf(address(this));
    IERC20_071(Scarcity).transfer(localParams.limbo, scxBal);
    localParams.soul = address(0); // prevent non limbo from executing.
    params = localParams;
    return true;
  }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/Ownable.sol";
import "../facades/MorgothTokenApproverLike.sol";
import "../facades/TokenProxyRegistryLike.sol";
import "../libraries/ProxyDeployer.sol" as Deployer;
import "../libraries/ERC20MetadataHelper.sol";
import "../facades/LimboProxyLike.sol";

/**
@author Justin Goro
@notice Behodler needs protecting from malicious token listing or open listing of questionable projects. 
The token approver is owned by MorgothDAO. Tokens can be listed on Limbo if they pass 1 of 3 tests:
1. Wrapped as a cliffFace through the Token Approver which maintains a mapping
2. Perpetual tokens do not pose a systemic risk, only a risk to staking users
3. Whitelisted by MorgothDAO. 
 */
contract MorgothTokenApprover is MorgothTokenApproverLike, Ownable {
  using MetadataHelper for address;
  using Deployer.ProxyDeployer for address;
  struct EcosystemConfig {
    address referenceToken;
    address proxyRegistry;
    address behodler;
    address limbo;
    address flan;
  }

  EcosystemConfig public config;

  struct BaseTokenConfig {
    address cliffFace;
    bool approved;
    bool blocked;
  }
  mapping(address => BaseTokenConfig) public baseTokenMapping;

  function approveOrBlock(address token, bool approve, bool blocked) public onlyOwner {
    baseTokenMapping[token].approved = approve;
    baseTokenMapping[token].blocked = blocked;
  }

  ///@dev At deployment, this is the initialization function
  function updateConfig(
    address proxyRegistry,
    address referenceToken,
    address behodler,
    address limbo,
    address flan
  ) public onlyOwner {
    config.referenceToken = referenceToken;
    config.proxyRegistry = proxyRegistry;
    config.behodler = behodler;
    config.limbo = limbo;
    config.flan = flan;
  }

  uint256 constant ONE = 1e18;
  address constant NULL = address(0);

  ///@notice in the event of botched generation
  function unmapCliffFace(address baseToken) public onlyOwner {
    baseTokenMapping[baseToken].cliffFace = NULL;
    TokenProxyRegistryLike registry = TokenProxyRegistryLike(config.proxyRegistry);
    (address limboProxy, ) = registry.tokenProxy(baseToken);
    registry.setProxy(baseToken, limboProxy, NULL);
  }

  /**
      @notice an open function to generate a cliffFaceProxy for any token to be sent to Behodler.
      This function essentially decentralizes Limbo token listing entirely to the community without risk to Behodler.
      @dev some tokens don't have metadata. proxies are given metadata derived from the address. 
      The front end won't display this. 
      @param token base token
      @param referenceTokenMultiple see which token is being used as the reference token for behodler. 
      If it's Dai, then set this to a lower range dai price. Eg. suppose you're listing XToken which trades between $30 and $100. 
      Set the referenceMultiple for XToken to something like $15. This acts as the floor below which the token is considered to be failing.
      If the referenceMultiple is set too high, it could create high slippage on Behodler. If it's set too low, SCX and PyroXToken holders 
      could suffer high impermanent loss from a downturn.
      @param protectLimbo For FOT, rebase and any other tokens that could break Limbo functionality. Protects against some common rugpull tricks as well.
     */
  function generateCliffFaceProxy(address token, uint256 referenceTokenMultiple, bool protectLimbo) public {
    if (baseTokenMapping[token].cliffFace != NULL || baseTokenMapping[token].blocked) {
      revert Errors.InvalidBaseToken(token);
    }

    (string memory name, string memory symbol) = token.tryGetMetadata();
    address cliffFaceAddress = token.DeployCliffFace(
      name,
      symbol,
      config.proxyRegistry,
      config.referenceToken,
      referenceTokenMultiple,
      config.behodler,
      ONE
    );

    //To proposal voters, if a token is FOT or rebase and protectLimbo isn't true, be sure to reject the proposal.
    address limboToken = token;
    if (protectLimbo) {
      address limboProxyAddress = token.DeployLimboProxy(
        name,
        symbol,
        config.proxyRegistry,
        config.limbo,
        config.flan,
        ONE
      );
      LimboProxyLike(limboProxyAddress).approveLimbo();
      limboToken = address(limboProxyAddress);
    }
    baseTokenMapping[token].cliffFace = cliffFaceAddress;

    TokenProxyRegistryLike(config.proxyRegistry).setProxy(token, limboToken, cliffFaceAddress);
  }

  function approved(address token) public view override returns (bool) {
    return baseTokenMapping[token].approved || baseTokenMapping[token].cliffFace != NULL;
  }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./LimboProxy.sol";
import "../openzeppelin/Ownable.sol";
import "../facades/MorgothTokenApproverLike.sol";
import "../facades/TokenProxyRegistryLike.sol";
import "../periphery/Errors.sol";
import "../TokenProxies/TokenProxyBase.sol";
import "../libraries/AddressToString.sol";
import * as Deployer from "../libraries/ProxyDeployer.sol";
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

  //base->cliffFace
  mapping(address => address) public cliffFaceMapping;
  mapping(address => bool) public morgothApproved;
  mapping(address => bool) public blockedBaseTokens;

  function morgothApprove(address token, bool approve) public onlyOwner {
    morgothApproved[token] = approve;
  }

  ///@notice If we find a  token that can circumvent the CliffFace protections.
  function blockBaseToken(address token, bool blocked) public onlyOwner {
    blockedBaseTokens[token] = blocked;
  }

  ///@dev At deployment, this is the initialization function
  function updateConfig(
    address proxyRegistry,
    address referenceToken,
    address behodler,
    address limbo,
    address flan
  ) public onlyOwner {
    _updateConfig(proxyRegistry, referenceToken, behodler, limbo, flan);
  }

  function _updateConfig(
    address proxyRegistry,
    address referenceToken,
    address behodler,
    address limbo,
    address flan
  ) internal {
    config.referenceToken = referenceToken;
    config.proxyRegistry = proxyRegistry;
    config.behodler = behodler;
    config.limbo = limbo;
    config.flan = flan;
  }

  uint256 constant ONE = 1e18;

  ///@notice in the event of botched generation
  function unmapCliffFace(address baseToken) public onlyOwner {
    cliffFaceMapping[baseToken] = address(0);
    TokenProxyRegistryLike registry = TokenProxyRegistryLike(config.proxyRegistry);
   (address limboProxy, ) =  registry.tokenProxy(baseToken);
    TokenProxyRegistryLike(config.proxyRegistry).setProxy(baseToken,limboProxy,address(0));
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
  function generateCliffFaceProxy(
    address token,
    uint256 referenceTokenMultiple,
    bool protectLimbo
  ) public {
    if (cliffFaceMapping[token] != address(0)) {
      revert TokenAlreadyRegistered(token);
    }
    if (blockedBaseTokens[token]) {
       revert CliffFaceGenerationBlocked(token);
    }

    (string memory name, string memory symbol) = token.tryGetMetadata(); 
    address cliffFaceAddress = 
      token.DeployCliffFace(
      string(abi.encodePacked(name, "_CF")),
      string(abi.encodePacked(symbol, "_CF")),
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
        string(abi.encodePacked(name, "_Lim")),
        string(abi.encodePacked(symbol, "_Lim")),
        config.proxyRegistry,
        config.limbo,
        config.flan,
        ONE
      );
      LimboProxyLike(limboProxyAddress).approveLimbo();
      limboToken = address(limboProxyAddress);
    }
    cliffFaceMapping[token] = cliffFaceAddress;

    //Clearer error speeds up deployment debugging
    if (address(config.proxyRegistry) == address(0)) {
       revert ContractNotInitialized();
    }
    TokenProxyRegistryLike(config.proxyRegistry).setProxy(token, limboToken,cliffFaceAddress);
  }

  function approved(address token) public view override returns (bool) {
    if (morgothApproved[token]) return true;

    //if this is a registered cliffFace token, else return false
    try TokenProxyBase(token).baseToken() returns (address base) {
      return cliffFaceMapping[token] == base;
    } catch {
      return false;
    }
  }
}

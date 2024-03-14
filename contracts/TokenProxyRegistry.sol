// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./DAO/Governable.sol";
import "./TokenProxies/TokenProxyBase.sol";
import "./TokenProxies/BehodlerTokenProxy.sol";
import "./openzeppelin/SafeERC20.sol";
import "./facades/BehodlerLike.sol";
///@author Justin Goro
///@title Token Proxy Registry for exotic token registration on Limbo
/**@notice
ERC20 tokens can behave in unpredictable ways, sometimes deviating from the standard and other times conforming but nonetheless undermining norms such as with rebase tokens.
To allow protocols to be written for the generic treatment of ERC20 tokens while not being vulnerable to idiosyncrasies of implementeation,
a proxy standard is proposed that wraps tokens so that they conform to predictable behaviour. This is already widely practiced with the treatment of Eth->WETH
A second reason for proxies is to protect a single-pool liquidity AMM like Behodler from terminal price decline. For such an AMM, a crashing token price would 
result in an impermanent loss death spiral as all liquidity is replaced with the crashing token and the universal liquidity token becomes a mere wrapper
for a deadcoin.
@dev The registry is to assist in the migration process (crossover in Limbo nomenclature) from Limbo to Behodler.
When a token is ready to cross, Morgoth can inspect to see if the token should be unwound from a limbo proxy
and if that base token should then be wrapped up in a new proxy for use in Behodler. Zero address implies no proxy wrapping. 
*/
contract TokenProxyRegistry is Governable {
  using SafeERC20 for IERC20;
  struct TokenConfig {
    address limboProxy;
    address behodlerProxy;
  }

  address tokenApprover;
  address limboAddTokenToBehodlerPower;
  BehodlerLike immutable behodler;

  mapping(address => TokenConfig) public tokenProxy; //maps base token to proxies

  constructor(address dao, address _behodler) Governable(dao) {
    behodler = BehodlerLike(_behodler);
  }

  modifier proposalOrApprover() {
    if (msg.sender != tokenApprover && configured() && !LimboDAOLike(DAO).successfulProposal(msg.sender)) {
      revert GovernanceActionFailed(configured(), msg.sender);
    }
    _;
  }

  function setPower(address _power) public onlySuccessfulProposal {
    limboAddTokenToBehodlerPower = _power;
  }

  function setTokenApprover(address approver) public onlySuccessfulProposal {
    tokenApprover = approver;
  }

  function setProxy(
    address baseToken,
    address limboProxy,
    address behodlerProxy
  ) public proposalOrApprover returns (bool ownershipClaimed) {
    tokenProxy[baseToken] = TokenConfig(limboProxy, behodlerProxy);
    ownershipClaimed = true;
  }

  /**@dev this is a decision tree and should not revert on logic, lest it griefs migrations
   * Remember to transfer the held token for this contract.
   */
  function TransferFromLimboTokenToBehodlerToken(address token) public returns (bool) {
    if (msg.sender != limboAddTokenToBehodlerPower) {
      revert NotMorgothPower(msg.sender, limboAddTokenToBehodlerPower);
    }
    address baseToken = token;
    try TokenProxyBase(token).IS_PROXY() returns (bool) {
      baseToken = TokenProxyBase(token).baseToken();
    } catch {}

    TokenConfig memory config = tokenProxy[baseToken];
    uint256 balance = 0;
    if (config.limboProxy != address(0)) {
      //prevents someone messing up the seeding of Behodler
      uint256 balanceBefore = IERC20(baseToken).balanceOf(address(this));
      TokenProxyBase(token).withdrawReserve();
      balance = IERC20(baseToken).balanceOf(address(this)) - balanceBefore;
    } else {
      balance = IERC20(token).balanceOf(address(this));
    }

    if (config.behodlerProxy != address(0)) {
      IERC20(baseToken).safeApprove(config.behodlerProxy, type(uint256).max);
      BehodlerTokenProxy(config.behodlerProxy).seedBehodler(balance, msg.sender);
    } else {
      IERC20(baseToken).safeApprove(address(behodler), type(uint256).max);
      uint256 scx = behodler.addLiquidity(baseToken, balance);
      behodler.transfer(msg.sender, scx);
    }
    return true;
  }

  function migrateProxyTokenToNewProxyWrapper(
    address existingProxy,
    address newProxyToken
  ) public onlySuccessfulProposal {
    TokenProxyBase(existingProxy).migrateBaseReserveToNewProxy(newProxyToken);
    address baseToken = TokenProxyBase(existingProxy).baseToken();
    TokenConfig memory existingConfig = tokenProxy[baseToken];
    if (existingConfig.limboProxy == existingProxy) {
      existingConfig.limboProxy = newProxyToken;
    } else if (existingConfig.behodlerProxy == existingProxy) {
      existingConfig.behodlerProxy = newProxyToken;
    }

    tokenProxy[baseToken] = existingConfig;
  }
}

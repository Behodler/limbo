// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../DAO/Governable.sol";
import "../periphery/RealEcosystem/PyroTokensV3/LiquidityReceiver.sol";
import "../facades/FlanLike.sol";
import "../facades/PyroTokenLike.sol";

/** 
@author Justin Goro
@notice By giving this contract the right to mint Flan, we can use proposals to set a flan per second per flan (ie. an APY) on the reserves in PyroFlan
In other words, we can put a floor on the PyroFlan redeem rate growth. This means we don't need a Limbo PyroFlan pool.
It also means we can create an above market growth that can't be bid down.
If you mint using underlying PyroFlan, you lower the growth rate and if you redeem using the underlying, you forgo all growth since the last minting.
*/
contract PyroFlanBooster is Governable {
  uint256 constant FixedPointDeflator = 1e18;

  uint256 constant YEAR = 31536000;

  constructor(address _dao) Governable(_dao) {
    mintVars.last = block.timestamp;
    mintVars.balance = 0;
  }

  struct Config {
    uint256 flanPerFlanPerSecond; // wei units
    address flan;
    address pyroFlan;
    address liquidityReceiver;
  }
  struct LastMintVars {
    uint256 last;
    uint256 balance;
  }

  Config public config;
  LastMintVars public mintVars;

  /**
  @param flanPerFlanPerYear Flan minted for every unit of FLN in the PyroFlan reserve over the course of a year. This assumes the reserve is static for the year
  @param flan Contract address for Flan Token
  @param pyroFlan Contract Address for PyroFlan Token
  @param liquidityReceiver Contract Address for PyroToken V3 LiquidityReceiver
 */
  function configure(
    uint256 flanPerFlanPerYear,
    address flan,
    address pyroFlan,
    address liquidityReceiver
  ) public onlySuccessfulProposal {
    config.flanPerFlanPerSecond = flanPerFlanPerYear / YEAR;
    config.flan = flan;
    IERC20(flan).approve(pyroFlan, type(uint256).max);
    config.liquidityReceiver = liquidityReceiver;
    config.pyroFlan = pyroFlan;
    boostRerserves();
    updateMintVars();
  }

  function getBalance() internal view returns (uint256) {
    IERC20 flan = IERC20(config.flan);
    return flan.balanceOf(config.pyroFlan) + flan.balanceOf(config.liquidityReceiver);
  }

  function boostRerserves() internal {
    uint256 elapsed = block.timestamp - mintVars.last;
    uint256 balanceBefore = mintVars.balance;

    uint256 toMint = (elapsed * config.flanPerFlanPerSecond * balanceBefore) / FixedPointDeflator;
    if (toMint > 0) FlanLike(config.flan).mint(config.pyroFlan, toMint);
  }

  function updateMintVars() internal {
    mintVars.last = block.timestamp;
    mintVars.balance = getBalance();
  }

  //advance the redeem rate manually. Minting compounds the growth rate. This is balanced against the gas costs but a whale in PyroFlan may find it beneficial to trigger this occasionally.
  function atomicBoost() public boost {}

  modifier boost() {
    boostRerserves();
    _;
    updateMintVars();
  }

  ///mint and redeem are the same as for PyroTokens but in this contract, a Flan boost is applied.
  function mint(uint256 baseAmount, address recipient) public boost {
    IERC20(config.flan).transferFrom(msg.sender, address(this), baseAmount);
    PyroTokenLike(config.pyroFlan).mint(recipient, baseAmount);
  }

  /**@dev in deployment, snuff this contract of transfer fees
   */
  function redeem(uint256 pyroAmount, address recipient) public boost {
    IERC20(config.pyroFlan).transferFrom(msg.sender, address(this), pyroAmount);
    PyroTokenLike(config.pyroFlan).redeem(recipient, pyroAmount);
  }
}

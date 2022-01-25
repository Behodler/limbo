// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./facades/FlanLike.sol";
import "./facades/PyroTokenLike.sol";
import "./DAO/Governable.sol";
import "./ERC677/ERC20Burnable.sol";
import "./facades/UniPairLike.sol";

contract FlanBackstop is Governable {
  constructor(
    address dao,
    address pyroFlan,
    address flan
  ) Governable(dao) {
    config.pyroFlan = pyroFlan;
    config.flan = flan;
  }

  struct ConfigVars {
    address flan;
    address pyroFlan;
    mapping(address => address) flanLPs;
    mapping(address => address) pyroFlanLPs;
    mapping(address => uint256) acceptableHighestPrice; //Highest tolerated Flan per stable
  }

  ConfigVars public config;

  function setBacker(
    address stablecoin,
    address flanLP,
    address pyroFlanLP,
    uint256 acceptableHighestPrice
  ) external onlySuccessfulProposal {
    config.flanLPs[stablecoin] = flanLP;
    config.pyroFlanLPs[stablecoin] = pyroFlanLP;
    config.acceptableHighestPrice[stablecoin] = acceptableHighestPrice;
  }

  function purchasePyroFlan(address stablecoin, uint256 amount) external {
    address flanLP = config.flanLPs[stablecoin];
    address pyroFlanLP = config.pyroFlanLPs[stablecoin];
    require(flanLP != address(0) && pyroFlanLP != address(0), "BACKSTOP: configure stablecoin");

    uint256 balanceOfFlanBefore = IERC20(config.flan).balanceOf(flanLP);
    uint256 balanceOfStableBefore = IERC20(stablecoin).balanceOf(flanLP);
    uint256 priceBefore = (balanceOfFlanBefore * (1 ether)) / balanceOfStableBefore;

    //Price tilt pairs and mint liquidity
    FlanLike(config.flan).mint(address(this), amount / 2);
    IERC20(config.flan).transfer(flanLP, amount / 4);
    IERC20(stablecoin).transfer(flanLP, amount / 2);
    UniPairLike(flanLP).mint(address(this));

    PyroTokenLike(config.pyroFlan).mint(pyroFlanLP, amount / 4);
    IERC20(stablecoin).transfer(pyroFlanLP, amount / 4);
    UniPairLike(pyroFlanLP).mint(address(this));

    uint256 balanceOfFlan = IERC20(config.flan).balanceOf(flanLP);
    uint256 balanceOfStable = IERC20(stablecoin).balanceOf(flanLP);

    uint256 tiltedPrice = (balanceOfFlan * (1 ether)) / balanceOfStable;
    require(tiltedPrice < config.acceptableHighestPrice[stablecoin], "BACKSTOP: potential price manipulation");
    uint256 growth = ((tiltedPrice - priceBefore) * 100) / priceBefore;

    uint256 flanToMint = tiltedPrice * amount;

    //share some price tilting with the user to incentivize minting: The larger the purchase, the better the return
    uint256 premium = (flanToMint * (growth / 2)) / 100;
    FlanLike(config.flan).mint(address(this), flanToMint + premium);
    PyroTokenLike(config.pyroFlan).mint(msg.sender, flanToMint);
  }
}

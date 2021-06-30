// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./facades/UniswapHelperLike.sol";
import "./facades/AngbandLike.sol";
import "./facades/LimboAddTokenToBehodlerPowerLike.sol";
import "./facades/BehodlerLike.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Migrator {
    event TokenListed(address token, uint256 amount, uint256 scxfln_LP_minted);

    struct ConfigurationParameters {
        address limbo;
        LimboAddTokenToBehodlerPowerLike morgothPower;
        AngbandLike angband;
        UniswapHelperLike uniHelper;
        BehodlerLike behodler;
    }

    ConfigurationParameters public config;

    uint256 constant TERA = 1E12;
    uint256 constant SCX_calc = TERA * 10000;

    constructor(
        address limbo,
        address angband,
        address uniHelper,
        address behodler,
        address power
    ) {
        config.limbo = limbo;
        config.angband = AngbandLike(angband);
        config.uniHelper = UniswapHelperLike(uniHelper);
        config.behodler = BehodlerLike(behodler);
        config.morgothPower = LimboAddTokenToBehodlerPowerLike(power);
    }

    function exectute(
        address token,
        bool burnable,
        uint256 flanQuoteDivergenceTolerance,
        uint256 minQuoteWaitDuration
    ) public {
        require(msg.sender == config.limbo, "LIMBO: Only callable by Limbo");
        //parameterize LimboAddTokenToBehodler
        config.morgothPower.parameterize(token, burnable);

        //invoke Angband execute on power that migrates token type to Behodler
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(address(config.morgothPower), tokenBalance);
        config.angband.executePower(address(config.morgothPower));

        //get marginal SCX price and calculate rectangle of fairness
        uint256 scxMinted = IERC20(address(config.behodler)).balanceOf(
            address(this)
        );

        uint256 tokensToRelease = BehodlerLike(config.behodler)
        .withdrawLiquidityFindSCX(token, 1000, 10000, 8);
        uint256 marginalPrice = SCX_calc / tokensToRelease;

        uint256 rectangleOfFairness = (marginalPrice * tokenBalance) / SCX_calc;

        //burn SCX - rectangle
        uint256 excessSCX = scxMinted - rectangleOfFairness;
        require(config.behodler.burn(excessSCX), "E8");

        uint256 lpMinted = config.uniHelper.buyAndPoolFlan(
            flanQuoteDivergenceTolerance,
            minQuoteWaitDuration,
            rectangleOfFairness
        );

        emit TokenListed(token, tokenBalance, lpMinted);
    }
}

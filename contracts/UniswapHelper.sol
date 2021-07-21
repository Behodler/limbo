// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./facades/UniPairLike.sol";
import "./facades/UniswapRouterLike.sol";
import "./facades/BehodlerLike.sol";
import "./DAO/Governable.sol";
import "hardhat/console.sol";
import "./ERC677/ERC20Burnable.sol";

contract BlackHole {}

contract UniswapHelper is Governable {
    address limbo;
    struct UniVARS {
        address token0;
        address token1;
        address inputToken;
        address outputToken;
        uint256 reserveA;
        uint256 reserveB;
        uint256 expectedOutputToken;
        uint256 amountIn;
        address[] path;
        uint256 transferFee;
        UniPairLike Flan_SCX_tokenPair;
        UniswapRouterLike router;
        address behodler;
        address blackHole;
        address flan;
    }

    UniVARS VARS;
    uint256 constant EXA = 1e18;

    function blackHole () public view returns (address){
        return VARS.blackHole;
    }

    constructor(address _limbo, address limboDAO) Governable(limboDAO) {
        limbo = _limbo;
        VARS.blackHole = address(new BlackHole());
    }

    struct FlanQuote {
        uint256 exaRatio;
        uint256 blockProduced;
    }
    FlanQuote public latestFlanQuote;

    function configure(
        address _limbo,
        address FlanSCXPair,
        address behodler,
        address flan,
        address router
    ) public onlySuccessfulProposal {
        limbo = _limbo;
        VARS.Flan_SCX_tokenPair = UniPairLike(FlanSCXPair);
        VARS.behodler = behodler;
        VARS.flan = flan;
        VARS.router = UniswapRouterLike(router);
    }

    //First punch this and then wait a c
    function generateFLNQuote() public {
        // block delay
        latestFlanQuote.exaRatio = getLatestFLNQuote();
        latestFlanQuote.blockProduced = block.number;
    }

    function getLatestFLNQuote() internal view returns (uint256) {
        (uint256 reserve1, uint256 reserve2, ) = VARS
        .Flan_SCX_tokenPair
        .getReserves();
        return ((reserve1 * EXA) / reserve2);
    }

    //the purpose of the divergence code is to bring the robustness of a good oracle without requiring an oracle
    function buyAndPoolFlan(
        uint256 divergenceTolerance,
        uint256 minQuoteWaitDuration,
        uint256 rectangleOfFairness
    ) public returns (uint256 lpMinted) {
        require(msg.sender == limbo);
        //purchase flan with half remaining scx:
        // 1. Get uniswap price quote
        // 2.Invoke uniswap router to buy.
        VARS.inputToken = VARS.behodler;
        VARS.outputToken = VARS.flan;

        (VARS.token0, VARS.token1) = VARS.inputToken < VARS.outputToken
            ? (VARS.inputToken, VARS.outputToken)
            : (VARS.outputToken, VARS.inputToken);

        uint256 flanQuote = getLatestFLNQuote();
        uint256 divergence = latestFlanQuote.exaRatio > flanQuote
            ? (latestFlanQuote.exaRatio * 100) / flanQuote
            : (flanQuote * 100) / latestFlanQuote.exaRatio;
        console.log(
            "divergence %s, divergence tolerance %s",
            divergence,
            divergenceTolerance
        );

        require(divergence < divergenceTolerance, "EG");
        require(
            block.number - latestFlanQuote.blockProduced > minQuoteWaitDuration,
            "EH"
        );
        {
            (uint256 reserve1, uint256 reserve2, ) = VARS
            .Flan_SCX_tokenPair
            .getReserves();
            VARS.reserveA = VARS.inputToken == VARS.token0
                ? reserve1
                : reserve2;
            VARS.reserveB = VARS.inputToken == VARS.token0
                ? reserve2
                : reserve1;

            (VARS.transferFee, , ) = BehodlerLike(VARS.behodler).config();
            VARS.amountIn = ((rectangleOfFairness * (1000 - VARS.transferFee)) /
                2000);

            VARS.expectedOutputToken = VARS.router.quote(
                VARS.amountIn,
                VARS.reserveA,
                VARS.reserveB
            );

            VARS.path = new address[](2);
            VARS.path[0] = VARS.behodler;
            VARS.path[1] = VARS.flan;
            IERC20(VARS.behodler).approve(
                address(VARS.router),
                type(uint256).max
            );

            //swap scx for flan
            VARS.router.swapExactTokensForTokens(
                VARS.amountIn,
                VARS.expectedOutputToken,
                VARS.path,
                address(VARS.Flan_SCX_tokenPair),
                type(uint256).max
            );

            //mint FLN/SCX LP
            BehodlerLike(VARS.behodler).transfer(
                address(VARS.Flan_SCX_tokenPair),
                VARS.amountIn
            );

        }
        lpMinted = VARS.Flan_SCX_tokenPair.mint(VARS.blackHole);
    }
}

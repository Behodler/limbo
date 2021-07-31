// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./facades/UniPairLike.sol";
import "./facades/BehodlerLike.sol";
import "./DAO/Governable.sol";
// import "hardhat/console.sol";
import "./ERC677/ERC20Burnable.sol";
import "./facades/FlanLike.sol";

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
        address behodler;
        address blackHole;
        address flan;
        uint256 divergenceTolerance;
        uint256 minQuoteWaitDuration;
        address DAI;
        uint256 behodlerActiveBondingCurves;
        uint8 precision;
    }

    UniVARS VARS;
    uint256 constant EXA = 1e18;

    /*
    instead of relying on oracles, we simply require snapshots of important 
    prices to be taken at intervals far enough apart.
    If an attacker wishes to overstate or understate a price through market manipulation,
    they'd have to keep it out of equilibrium over the span of the two snapshots or they'd
    have to time the manipulation to happen as the snapshots occur. As a miner,
    they could do this through transaction ordering but they'd have to win two blocks at precise moments
    which is statistically highly unlikely. 
    The snapshot enforcement can be hindered by false negatives. Natural price variation, for instance, but the cost
    of this is just having to snapshot again when the market is calmer. Since migration is not not time sensitive,
    this is a cost worth bearing.
    */

    modifier ensurePriceStability {
        _ensurePriceStability();
        _;
    }

    modifier incrementBondingCurves {
        _;
        VARS.behodlerActiveBondingCurves++;
    }

    modifier onlyLimbo {
        require(msg.sender == limbo);
        _;
    }

    function blackHole() public view returns (address) {
        return VARS.blackHole;
    }

    constructor(address _limbo, address limboDAO) Governable(limboDAO) {
        limbo = _limbo;
        VARS.blackHole = address(new BlackHole());
    }

    struct FlanQuote {
        uint256 FlanScxExaRatio;
        uint256 DaiScxSpotPrice;
        uint256 DaiBalanceOnBehodler;
        uint256 blockProduced;
    }
    FlanQuote[2] public latestFlanQuotes; //0 is latest

    function setDAI(address dai) public onlySuccessfulProposal {
        VARS.DAI = dai;
    }

    function configure(
        address _limbo,
        address FlanSCXPair,
        address behodler,
        address flan,
        uint256 divergenceTolerance,
        uint256 minQuoteWaitDuration,
        uint256 behodlerActiveBondingCurves,
        uint8 precision
    ) public onlySuccessfulProposal {
        limbo = _limbo;
        VARS.Flan_SCX_tokenPair = UniPairLike(FlanSCXPair);
        VARS.behodler = behodler;
        VARS.flan = flan;
        VARS.divergenceTolerance = divergenceTolerance;
        VARS.minQuoteWaitDuration = minQuoteWaitDuration;
        VARS.DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
        VARS.behodlerActiveBondingCurves = behodlerActiveBondingCurves;
        VARS.precision = precision ==0? precision:precision;
    }

    //First punch this and then wait a c
    function generateFLNQuote() public {
        latestFlanQuotes[1] = latestFlanQuotes[0];
        (
            // block delay
            latestFlanQuotes[0].FlanScxExaRatio,
            latestFlanQuotes[0].DaiScxSpotPrice,
            latestFlanQuotes[0].DaiBalanceOnBehodler
        ) = getLatestFLNQuote();
        latestFlanQuotes[0].blockProduced = block.number;
    }

    function getLatestFLNQuote()
        internal
        view
        returns (
            uint256 fln_scx,
            uint256 dai_scx,
            uint256 daiBalanceOnBehodler
        )
    {
        //need order to b,e SCX per flan
        (uint256 reserve1, uint256 reserve2, ) = VARS
        .Flan_SCX_tokenPair
        .getReserves();
        //Flan per SCX
        if (VARS.flan < VARS.behodler) {
            fln_scx = ((reserve1 * EXA) / reserve2);
        } else {
            fln_scx = ((reserve2 * EXA) / reserve1);
        }

        uint256 daiToRelease = BehodlerLike(VARS.behodler)
        .withdrawLiquidityFindSCX(VARS.DAI, 10000, 1 ether, VARS.precision);
        dai_scx = (daiToRelease * EXA) / (1 ether);

        daiBalanceOnBehodler = IERC20(VARS.DAI).balanceOf(VARS.behodler);
    }

    function priceTiltFlan(uint256 rectangleOfFairness)
        public
        onlyLimbo
        ensurePriceStability
        incrementBondingCurves
        returns (uint256 lpMinted)
    {
        //Total Value Bonded (TVB) is approximated by multiplying the Dai TVL by the number of active bonding curves. The more liquidity, the more accurate
        //LP price = TVB/SCX_totalSupply as per the Uniswap formula ($/unit)

        //dai per scx
        uint256 LP_price_synthetic = (latestFlanQuotes[0].DaiBalanceOnBehodler *
            VARS.behodlerActiveBondingCurves) /
            BehodlerLike(VARS.behodler).totalSupply();

        uint256 finalSCXBalanceOnLP = rectangleOfFairness +
            IERC20(VARS.behodler).balanceOf(address(VARS.Flan_SCX_tokenPair));

        uint ratioOfPrices = latestFlanQuotes[0].DaiScxSpotPrice/LP_price_synthetic;
        uint ExpectedFinalFlanBal = (finalSCXBalanceOnLP*ratioOfPrices)/EXA;
        //uint256 ExpectedFinalFlanBal = (SCX_Bal_dai) / (LP_price_synthetic);
        // uint256 ExpectedFinalFlanBal = SCX_Bal_dai / LP_price_synthetic;
        uint256 FLN_Bal = IERC20(VARS.flan).balanceOf(
            address(VARS.Flan_SCX_tokenPair)
        );

        uint256 flanToMint = ExpectedFinalFlanBal > FLN_Bal
            ? ExpectedFinalFlanBal - FLN_Bal
            : 1000; //MIN LIQUIDITY ON UNISWAPv2 IS 1000

        IERC20(VARS.behodler).transfer(
            address(VARS.Flan_SCX_tokenPair),
            rectangleOfFairness
        );
        FlanLike(VARS.flan).mint(address(VARS.Flan_SCX_tokenPair), flanToMint);
        lpMinted = VARS.Flan_SCX_tokenPair.mint(VARS.blackHole);
    }

    /* 
    Cnvert the AVB on Behodler from Dai into Flan
    Calculate flan per second from APY
    minAPY has 4 decimal places. Eg 299 = 0.0299 = 2.99%
    fps is in pure wei units
    */
    function minAPY_to_FPS(uint256 minAPY, uint256 daiThreshold)
        public
        view
        ensurePriceStability
        returns (uint256 fps)
    {
        //Dai*10k/flan
        uint256 threshold = daiThreshold == 0
            ? latestFlanQuotes[0].DaiBalanceOnBehodler * 1e8
            : daiThreshold * 1e8;
        uint256 DAIPerFlan = (latestFlanQuotes[0].DaiScxSpotPrice * 1e4) /
            latestFlanQuotes[0].FlanScxExaRatio;

        //The average value of a bonding curve on behodler expressed in Flan *1e4
        uint256 AVB_flan = threshold / DAIPerFlan;
        fps = (AVB_flan * minAPY) / 1e12;
    }

    //the purpose of the divergence code is to bring the robustness of a good oracle without requiring an oracle
    function _ensurePriceStability() internal view {
        FlanQuote[2] memory localFlanQuotes; //save gas
        localFlanQuotes[0] = latestFlanQuotes[0];
        localFlanQuotes[1] = latestFlanQuotes[1];

        uint256 flanSCXDivergence = localFlanQuotes[0].FlanScxExaRatio >
            localFlanQuotes[1].FlanScxExaRatio
            ? (localFlanQuotes[0].FlanScxExaRatio * 100) /
                localFlanQuotes[1].FlanScxExaRatio
            : (localFlanQuotes[1].FlanScxExaRatio * 100) /
                localFlanQuotes[0].FlanScxExaRatio;

        uint256 daiSCXSpotPriceDivergence = localFlanQuotes[0].DaiScxSpotPrice >
            localFlanQuotes[1].DaiScxSpotPrice
            ? (localFlanQuotes[0].DaiScxSpotPrice * 100) /
                localFlanQuotes[1].DaiScxSpotPrice
            : (localFlanQuotes[1].DaiScxSpotPrice * 100) /
                localFlanQuotes[0].DaiScxSpotPrice;

        uint256 daiBalanceDivergence = localFlanQuotes[0].DaiBalanceOnBehodler >
            localFlanQuotes[1].DaiBalanceOnBehodler
            ? (localFlanQuotes[0].DaiBalanceOnBehodler * 100) /
                localFlanQuotes[1].DaiBalanceOnBehodler
            : (localFlanQuotes[1].DaiBalanceOnBehodler * 100) /
                localFlanQuotes[0].DaiBalanceOnBehodler;

        require(
            flanSCXDivergence < VARS.divergenceTolerance &&
                daiSCXSpotPriceDivergence < VARS.divergenceTolerance &&
                daiBalanceDivergence < VARS.divergenceTolerance,
            "EG"
        );

        require(
            localFlanQuotes[0].blockProduced -
                localFlanQuotes[1].blockProduced >
                VARS.minQuoteWaitDuration &&
                localFlanQuotes[1].blockProduced > 0,
            "EH"
        );
    }
}

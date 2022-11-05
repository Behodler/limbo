// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../../facades/BehodlerLike.sol";
import "../../../../openzeppelin/IERC20.sol";
import "../../../../facades/FlanLike.sol";
import "../facades/UniswapPairLike.sol";
import "../facades/UniswapFactoryLike.sol";
import "../../../../facades/LachesisLike.sol";
import "../../../../facades/LiquidityReceiverLike.sol";
import "../Powers.sol";

contract FlanGenesisRegisterFlan is PowerInvoker {
    struct Parameters {
        address gasRecipient; // compensated with flan for enormous gas expenditure
        IERC20 dai;
        FlanLike flan;
        UniswapPairLike uniswapPair;
        UniswapPairLike sushiPair;
        BehodlerLike scarcity;
        LachesisLike lachesis;
    }

    Parameters params;

    constructor(
        address _angband,
        address dai,
        address _uniswapFactory,
        address _sushiSwapFactory,
        address flan,
        address behodler,
        address liquidityReceiver
    ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
        params.dai = IERC20(dai);
        params.flan = FlanLike(flan);

        UniswapFactoryLike uniswapFactory = UniswapFactoryLike(_uniswapFactory);
        address uniPair = uniswapFactory.getPair(behodler, flan);
        if (uniPair == address(0)) {
            uniswapFactory.createPair(behodler, flan);
            params.uniswapPair = UniswapPairLike(
                uniswapFactory.getPair(behodler, flan)
            );
        }

        UniswapFactoryLike sushiFactory = UniswapFactoryLike(_sushiSwapFactory);
        address sushiPair = sushiFactory.getPair(behodler, flan);
        if (sushiPair == address(0)) {
            sushiFactory.createPair(behodler, flan);
            params.sushiPair = UniswapPairLike(
                sushiFactory.getPair(behodler, flan)
            );
        }

        params.scarcity = BehodlerLike(behodler);
    }

    /*
    1. Get Dai balance on Behodler
    2. Enable Flan on Behodler as non burnable
    3. Register pyrotoken
    4. Deposit Correct amount of flan.
    5. Wrap a small amount of flan as pyrotoken, send to designated caller
    6. send flan and 25 scx to uniswap && mint and burn
    7. send flan and 25 scx to sushi && mint and burn
    */
    function orchestrate() internal override returns (bool) {
        uint256 daiBalanceOnBehodler = params.dai.balanceOf(
            address(params.scarcity)
        );
        LachesisLike lachesis = LachesisLike(angband.getAddress(power.domain));
        lachesis.measure(address(params.flan), true, false);
        lachesis.updateBehodler(address(params.flan));
        params.flan.mint(address(this), daiBalanceOnBehodler);
        params.flan.approve(address(params.scarcity), type(uint).max);
        params.scarcity.addLiquidity(
            address(params.flan),
            daiBalanceOnBehodler
        );
        uint256 daiToSend = params.scarcity.withdrawLiquidityFindSCX(
            address(params.dai),
            1000,
            25 ether,
            20
        );

        address uniswapPair = address(params.uniswapPair);
        params.flan.mint(uniswapPair, daiToSend);
        params.scarcity.transfer(uniswapPair, 25 ether);
        params.uniswapPair.mint(address(this));

        address sushiswapPair = address(params.sushiPair);
        params.flan.mint(sushiswapPair, daiToSend);
        params.scarcity.transfer(sushiswapPair, 25 ether);
        params.sushiPair.mint(address(this));
        return true;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../facades/BehodlerLike.sol";
import "../openzeppelin/IERC20.sol";
import "../facades/FlanLike.sol";
import "../facades/UniswapPairLike.sol";
import "../facades/UniswapFactoryLike.sol";
import "../facades/LachesisLike.sol";
import "../facades/LiquidityReceiverLike.sol";
import "../Powers.sol";

/*
PYROADMIN: 0x5059524f41444d494e0000000000000000000000000000000000000000000000
LIQUIDITYRECEIVER: 0x4c49515549444954595245434549564552000000000000000000000000000000
*/
contract FlanGenesisRegisterFlan is PowerInvoker {
    struct Parameters {
        address gasRecipient; // compensated with flan for enormous gas expenditure
        IERC20_071 dai;
        Flan_071Like flan;
        UniswapPairLike uniswapPair;
        UniswapPairLike sushiPair;
        Behodler_071Like scarcity;
        Lachesis_071Like lachesis;
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
        params.dai = IERC20_071(dai);
        params.flan = Flan_071Like(flan);

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

        params.scarcity = Behodler_071Like(behodler);
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
        Lachesis_071Like lachesis = Lachesis_071Like(angband.getAddress(power.domain));
        lachesis.measure(address(params.flan), true, false);
        lachesis.updateBehodler(address(params.flan));
        params.flan.mint(address(this), daiBalanceOnBehodler);
        params.flan.approve(address(params.scarcity), uint256(-1));
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

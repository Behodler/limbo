// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../facades/LachesisLike.sol";
import "../openzeppelin/IERC20.sol";
import "../facades/BehodlerLike.sol";
import "../facades/LiquidityReceiverNewLike.sol";
import "hardhat/console.sol";

contract AddTokenAndValueToBehodlerPower is PowerInvoker, Empowered {
    address token;
    bool burnable;
    address rewardContract;
    address liquidityReceiverPower;

    constructor(
        address _token,
        bool _burnable,
        address _angband,
        address _rewardContract,
        address _liquidityReceiverPower
    ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
        token = _token;
        burnable = _burnable;
        rewardContract = _rewardContract;
        liquidityReceiverPower = _liquidityReceiverPower;
    }

    function orchestrate() internal override returns (bool) {
        console.log('in orchestrate');
        address _lachesis = angband.getAddress(power.domain);
        address behodler = angband.getAddress("BEHODLER");
        Lachesis_071Like lachesis = Lachesis_071Like(_lachesis);
        lachesis.measure(token, true, burnable);
        lachesis.updateBehodler(token);
        angband.executePower(liquidityReceiverPower); 
        uint balanceOfToken = IERC20_071(token).balanceOf(address(this));
        console.log('balanceOf Token %d',balanceOfToken);
        require(balanceOfToken>0, "remember to seed contract");
        IERC20_071(token).approve(behodler,uint(-1));
        console.log('add token value power address %s',address(this));
        Behodler_071Like(behodler).addLiquidity(token,balanceOfToken);
        uint scxBal = IERC20_071(behodler).balanceOf(address(this));
        console.log('scxBal %d',scxBal);
        IERC20_071(behodler).transfer(rewardContract,scxBal);
        return true;
    }
}

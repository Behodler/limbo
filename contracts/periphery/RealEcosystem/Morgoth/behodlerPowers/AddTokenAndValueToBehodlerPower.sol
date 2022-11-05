// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";
import "../../../../facades/LachesisLike.sol";
import "../../../../openzeppelin/IERC20.sol";
import "../../../../facades/BehodlerLike.sol";


contract AddTokenAndValueToBehodlerPower is PowerInvoker {
    address token;
    bool burnable;
    address rewardContract;

    constructor(
        address _token,
        bool _burnable,
        address _angband,
        address _rewardContract
    ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
        token = _token;
        burnable = _burnable;
        rewardContract = _rewardContract;
    }

    function orchestrate() internal override returns (bool) {
        address _lachesis = angband.getAddress(power.domain);
        address behodler = angband.getAddress("BEHODLER");
        LachesisLike lachesis = LachesisLike(_lachesis);
        lachesis.measure(token, true, burnable);
        lachesis.updateBehodler(token);
        uint balanceOfToken = IERC20(token).balanceOf(address(this));
        require(balanceOfToken>0, "remember to seed contract");
        BehodlerLike(behodler).addLiquidity(token,balanceOfToken);
        uint scxBal = IERC20(behodler).balanceOf(address(this));
        IERC20(behodler).transfer(rewardContract,scxBal);
        return true;
    }
}

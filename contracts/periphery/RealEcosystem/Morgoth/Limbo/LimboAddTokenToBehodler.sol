// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./IdempotentPowerInvoker.sol";
import "../../../../facades/BehodlerLike.sol";

contract LimboAddTokenToBehodler is IdempotentPowerInvoker {
    struct Parameters {
        address soul;
        bool burnable;
        address limbo;
    }

    Parameters public params;

    constructor(address _angband, address limbo)
        IdempotentPowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband)
    {
        params.limbo = limbo;
    }

    function parameterize(address soul, bool burnable) public {
        require(
            msg.sender == params.limbo,
            "MORGOTH: Only Limbo can migrate tokens from Limbo."
        );
        params.soul = soul;
        params.burnable = burnable;
    }

    function orchestrate() internal override returns (bool) {
        address _lachesis = angband.getAddress(power.domain);
        address behodler = angband.getAddress("BEHODLER");
        require(params.soul!=address(0),"MORGOTH: PowerInvoker not parameterized.");
        LachesisLike lachesis = LachesisLike(_lachesis);
        lachesis.measure(params.soul, true, params.burnable);
        lachesis.updateBehodler(params.soul);
        uint256 balanceOfToken = IERC20(params.soul).balanceOf(address(this));
        require(balanceOfToken > 0, "MORGOTH: remember to seed contract");
        IERC20(params.soul).approve(behodler, type(uint).max);
        BehodlerLike(behodler).addLiquidity(params.soul, balanceOfToken);
        uint256 scxBal = IERC20(behodler).balanceOf(address(this));
        IERC20(behodler).transfer(params.limbo, scxBal);
        params.soul = address(0); // prevent non limbo from executing.
        return true;
    }
}

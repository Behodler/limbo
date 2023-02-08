// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "../facades/LiquidityReceiverLike.sol";
import "../facades/FlanLike.sol";
import "../facades/PyroTokenLike_071.sol";
import "../Powers.sol";

contract FlanGenesisRegisterPyroFlan is PowerInvoker {
    struct Parameters {
        LiquidityReceiver_071Like liquidityReceiver;
        Flan_071Like flan;
        address gasPayer;
    }
    Parameters params;

    constructor(
        address _angband,
        address liquidityReceiver,
        address flan,
        address gasPayer
    ) PowerInvoker("PYROADMIN", _angband) {
        params.liquidityReceiver = LiquidityReceiver_071Like(liquidityReceiver);
        params.flan = Flan_071Like(flan);
        params.gasPayer = gasPayer;
    }

    function orchestrate() internal override returns (bool) {
        params.liquidityReceiver.registerPyroToken(address(params.flan));
        PyroTokenLike_071 pyroflan = PyroTokenLike_071(
            params.liquidityReceiver.baseTokenMapping(address(params.flan))
        );
        params.flan.approve(address(pyroflan), uint256(-1));
        params.flan.mint(address(this), 500 ether);
        pyroflan.mint(500 ether);
        uint256 totalSupply = pyroflan.totalSupply();
        pyroflan.transfer(params.gasPayer, totalSupply);
        return true;
    }
}

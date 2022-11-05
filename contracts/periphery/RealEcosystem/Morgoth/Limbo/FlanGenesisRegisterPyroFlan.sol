// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../facades/LiquidityReceiverV2Like.sol";
import "../../../../facades/FlanLike.sol";
import "../../../../facades/PyroTokenLike.sol";
import "../Powers.sol";

contract FlanGenesisRegisterPyroFlan is PowerInvoker {
    struct Parameters {
        LiquidityReceiverV2Like liquidityReceiver;
        FlanLike flan;
        address gasPayer;
    }
    Parameters params;

    constructor(
        address _angband,
        address liquidityReceiver,
        address flan,
        address gasPayer
    ) PowerInvoker("PYROADMIN", _angband) {
        params.liquidityReceiver = LiquidityReceiverV2Like(liquidityReceiver);
        params.flan = FlanLike(flan);
        params.gasPayer = gasPayer;
    }

    function orchestrate() internal override returns (bool) {
        params.liquidityReceiver.registerPyroToken(address(params.flan));
        PyroTokenLike pyroflan = PyroTokenLike(
            params.liquidityReceiver.baseTokenMapping(address(params.flan))
        );
        params.flan.approve(address(pyroflan), type(uint).max);
        params.flan.mint(address(this), 500 ether);
        pyroflan.mint(msg.sender,500 ether);
        uint256 totalSupply = pyroflan.totalSupply();
        pyroflan.transfer(params.gasPayer, totalSupply);
        return true;
    }
}

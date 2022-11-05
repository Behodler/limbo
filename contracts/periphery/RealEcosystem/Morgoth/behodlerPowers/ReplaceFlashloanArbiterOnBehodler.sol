// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";
import "../../../../facades/LachesisLike.sol";
import "../../../../facades/FlashLoanArbiterLike.sol";

//stand in until a better scheme enabled.
contract ClosedArbiter is FlashLoanArbiterLike{
    function canBorrow (address borrower) public pure override returns (bool){
        return false;
    }
}

abstract contract ArbiterBehodler {
 function seed(
        address weth,//0x4f5704D9D2cbCcAf11e70B34048d41A0d572993F
        address lachesis,//0x99450D1475cb9DD1f34B991769780641A9A06572
        address flashLoanArbiter,
        address _pyroTokenLiquidityReceiver,//0xE80F95Da4DB121989DF7c0451165a6998a4600Fb
        address weidaiReserve,//0x2731e7a0947e7E18D17e757aF64cd438987b64cD
        address dai,//0x6b175474e89094c44da98b954eedeac495271d0f
        address weiDai//0xaFEf0965576070D1608F374cb14049EefaD218Ec
    ) external virtual;
}

contract ReplaceFlashloanArbiterOnBehodler is PowerInvoker {

    constructor(
        address _angband
    ) PowerInvoker("CONFIGURE_SCARCITY", _angband) {
    }

    function orchestrate() internal override returns (bool) {
        address b = angband.getAddress(power.domain);
        ArbiterBehodler behodler = ArbiterBehodler(b);
        address flashLoanArbiter = address(new ClosedArbiter());
        behodler.seed(
            0x4f5704D9D2cbCcAf11e70B34048d41A0d572993F,
            0x99450D1475cb9DD1f34B991769780641A9A06572,
            flashLoanArbiter,
            0xE80F95Da4DB121989DF7c0451165a6998a4600Fb,
            0x2731e7a0947e7E18D17e757aF64cd438987b64cD,
            0x6B175474E89094C44Da98b954EedeAC495271d0F,
            0xaFEf0965576070D1608F374cb14049EefaD218Ec
        );
        return true;
    }
}

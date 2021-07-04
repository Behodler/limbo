// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";
import "../../facades/FlanLike.sol";

contract AdjustFlanFeeOnTransferProposal is Proposal {
    struct Parameters {
        address flan;
        uint8 fee;
    }
    Parameters public params;

    constructor(address dao, string memory _description)
        Proposal(dao, description)
    {}

    function parameterize(
       address flan,
        uint8 fee
    ) public notCurrent {
        params.flan = flan;
        params.fee = fee;
    }

    function execute() internal override returns (bool) {
        FlanLike(params.flan).setBurnOnTransferFee(
          params.fee
        );
        return true;
    }
}

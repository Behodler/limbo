// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../facades/LimboDAOLike.sol";

contract WithdrawERC20Proposal is Proposal {
    struct Parameters {
        address token;
        address destination;
    }
    Parameters params;
    LimboLike limbo;

    constructor(address _dao) Proposal(_dao, "Withdraw errant tokens") {
        (address _limbo, , , , , , ) = LimboDAOLike(_dao).domainConfig();
        limbo = LimboLike(_limbo);
    }

    function parameterize(address token, address destination)
        public
        notCurrent
    {
        params.token = token;
        params.destination = destination;
    }

    function execute() internal override returns (bool) {
        limbo.withdrawERC20(params.token, params.destination);
        return true;
    }
}

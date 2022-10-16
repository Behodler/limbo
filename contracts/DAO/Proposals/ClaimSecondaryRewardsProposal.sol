// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../openzeppelin/SafeERC20.sol";

contract ClaimSecondaryRewardsProposal is Proposal {
  using SafeERC20 for IERC20;

  constructor(address _dao) Proposal(_dao, "ClaimSecondaryRewardProposal") {}

  struct Parameters {
    address token;
    address destination;
  }

  Parameters public params;

  function parameterize(address token, address destination) public lockUntilComplete {
    params.token = token;
    params.destination = destination;
  }

  function execute() internal override returns (bool) {
    (address _limbo, , , , , , ) = DAO.domainConfig();
    LimboLike limbo = LimboLike(_limbo);
    
    //claim secondary rewards from Limbo
    address token = params.token;
    uint256 balanceBefore = IERC20(token).balanceOf(address(this));
    limbo.claimSecondaryRewards(token);
    uint256 amount = IERC20(token).balanceOf(address(this)) - balanceBefore;

    //transfer out of proposal to correct address
    IERC20(token).safeTransfer(params.destination, amount);
    return true;
  }
}

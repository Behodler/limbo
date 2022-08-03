// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

abstract contract LimboDAOLike {
  function approveFlanMintingPower(address minter, bool enabled) public virtual;

  function makeProposal(address proposal, address proposer) public virtual;

  function currentProposalState()
    public
    view
    virtual
    returns (
      uint256,
      uint256,
      address,
      uint256,
      address
    );

  function setProposalConfig(
    uint256 votingDuration,
    uint256 requiredFateStake,
    address proposalFactory
  ) public virtual;

  function setApprovedAsset(
    address asset,
    bool approved,
    bool isUniswap,
    uint256 period
  ) public virtual;

  function successfulProposal(address proposal) public view virtual returns (bool);

  function domainConfig()
    public
    virtual
    returns (
      address,
      address,
      address,
      address,
      bool,
      address,
      address
    );

  function getFlashGoverner() external view virtual returns (address);

  function proposalConfig()
    public
    view
    virtual
    returns (
      uint256,
      uint256,
      address
    );

  function setFateSpender(address, bool) public virtual;

  function fateSpenders(address) public view virtual returns (bool);

  //second param is balance
  function fateState(address)
    public
    view
    virtual
    returns (
      uint256,
      uint256,
      uint256
    );

  function transferFate(
    address holder,
    address recipient,
    uint256 amount
  ) public virtual;
}

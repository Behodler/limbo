// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/IERC20.sol";

abstract contract PyroTokenLike is IERC20 {
  address public baseToken;

  function redeem(address recipient, uint256 amount) external virtual returns (uint256);

  function mint(address recipient, uint256 amount) public virtual returns (uint256 minted);

  function redeemRate() public view virtual returns (uint256);

  function totalSupply() public view virtual returns (uint256);

  function transfer(address recipient, uint256 amount) external virtual returns (bool);

  function config()
    public
    virtual
    view
    returns (
      address liquidityReceiver,
      IERC20 baseToken,
      address loanOfficer,
      bool pullPendingFeeRevenue
    );

  function name() public view virtual returns (string memory);

  function symbol() public view virtual returns (string memory);

  function decimals() public view virtual returns (uint8);

  function burn(uint256 amount) public virtual;

  function calculateTransferFee(
    uint256 amount,
    address sender,
    address receiver
  ) public view virtual returns (uint256);
}

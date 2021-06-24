// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./ERC677/ERC677.sol";
import "../contracts/DAO/Governable.sol";

contract Flan is ERC677("Flan", "FLN"), Governable {
    mapping(address => uint256) public mintAllowance; //uint(-1) == whitelist

    constructor(address dao) Governable(dao) {}

    function whiteListMinting(address minter, bool enabled)
        public
        onlySuccessfulProposal
    {
        mintAllowance[minter] = enabled ? type(uint256).max : 0;
    }

    function increaseMintAllowance(address minter, uint256 _allowance)
        public
        onlySuccessfulProposal
    {
        mintAllowance[minter] = mintAllowance[minter] +_allowance;
    }

    function mint(uint256 amount) public {
        uint256 allowance = mintAllowance[_msgSender()];
        require(
            _msgSender() == owner() || allowance >= amount,
            "Flan: Mint allowance exceeded"
        );
        approvedMint(_msgSender(), amount, _msgSender(), allowance);
    }

    function mint(address recipient, uint256 amount) public {
        uint256 allowance = mintAllowance[_msgSender()];
        require(
            _msgSender() == owner() || allowance >= amount,
            "Flan: Mint allowance exceeded"
        );
        approvedMint(recipient, amount, _msgSender(), allowance);
    }

    function approvedMint(
        address recipient,
        uint256 amount,
        address minter,
        uint256 allowance
    ) internal {
        _mint(recipient, amount);
        if (allowance < type(uint256).max) {
            mintAllowance[minter] = mintAllowance[minter] - amount;
        }
    }

     function safeTransfer(
        address _to,
        uint256 _amount
    ) external {
        uint256 flanBal = balanceOf(address(this));
        uint256 flanToTransfer = _amount > flanBal ? flanBal : _amount;
        _transfer(_msgSender(), _to, flanToTransfer);
    }
}

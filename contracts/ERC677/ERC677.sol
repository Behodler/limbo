// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IERC677Receiver.sol";

/*
All tokens in Limbo comply with the ERC677 standard. In addition they are ownable, alow burning
and can whitelist addresses with finite or infinite minting power
*/

contract ERC677 is ERC20Burnable, Ownable {
   
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {

    }

    mapping(address => uint256) public mintAllowance; //uint(-1) == whitelist
    function increaseMintAllowance(address minter, uint256 _allowance)
        public
        onlyOwner
    {
        mintAllowance[minter] += _allowance;
    }

    function mint(uint256 amount) public {
        uint256 allowance = mintAllowance[msg.sender];
        require(
            _msgSender() == owner() || allowance >= amount,
            "Mint allowance exceeded"
        );
        _mint(msg.sender, amount);
        if (amount < type(uint256).max) {
            mintAllowance[msg.sender] -= amount;
        }
    }

    /**
     * @dev transfer token to a contract address with additional data if the recipient is a contact.
     * @param _to The address to transfer to.
     * @param _value The amount to be transferred.
     * @param _data The extra data to be passed to the receiving contract.
     */
    function transferAndCall(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public returns (bool success) {
        super.transfer(_to, _value);
        _transfer(msg.sender, _to, _value);
        if (isContract(_to)) {
            contractFallback(_to, _value, _data);
        }
        return true;
    }

    function contractFallback(
        address _to,
        uint256 _value,
        bytes memory _data
    ) private {
        IERC677Receiver receiver = IERC677Receiver(_to);
        receiver.onTokenTransfer(msg.sender, _value, _data);
    }

    function isContract(address _addr) private view returns (bool hasCode) {
        uint256 length;
        assembly {
            length := extcodesize(_addr)
        }
        return length > 0;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {}
}

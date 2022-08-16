// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "./openzeppelin/ERC677.sol";
import "../contracts/DAO/Governable.sol";

///@author Justin Goro
///@title Flan
/**
 *@notice The reward token for Limbo. Flan can be minted without limit and is intended to converge on the price of DAI via various external incentives
 */
contract Flan is ERC677("Flan", "FLN"), Governable {
  mapping(address => bool) public mintAllowance; //type(uint).max == whitelist

  struct MintParameters {
    uint256 maxMintPerEpoch;
    uint256 aggregateMintingThisEpoch;
    uint128 lastEpochTimeStamp;
    uint128 EPOCH_SIZE;
  }

  MintParameters public mintConfig;

  constructor(address dao) Governable(dao) {
    mintConfig.lastEpochTimeStamp = uint128(block.timestamp); //it's never going to overflow
    mintConfig.EPOCH_SIZE = 86400; //one day
  }

  ///@notice grants unlimited minting power to a contract
  ///@param minter contract to be given unlimited minting power
  ///@param enabled minting power enabled or disabled
  function whiteListMinting(address minter, bool enabled) public onlySuccessfulProposal {
    mintAllowance[minter] = enabled;
  }

  ///@notice sets minting conditions to prevent overminting
  ///@param maxMintPerEpoch Maximum amount of flan mintable per epoch
  ///@param epochSize number of seconds per epoch of minting, 0 is default
  function setMintConfig(uint256 maxMintPerEpoch, uint128 epochSize) public onlySuccessfulProposal {
    mintConfig.maxMintPerEpoch = maxMintPerEpoch;
    mintConfig.EPOCH_SIZE = epochSize == 0 ? 86400 : epochSize;
  }

  ///@notice minting of flan open to approved minters and LimboDAO
  ///@param recipient address to receive flan
  ///@param amount amount of flan to be minted
  function mint(address recipient, uint256 amount) public returns (bool) {
    bool allowed = msg.sender == owner() || msg.sender == DAO || mintAllowance[msg.sender];
    if (!allowed) {
      revert MintingNotWhiteListed(msg.sender);
    }

    MintParameters memory config = mintConfig;
    if (block.timestamp - config.lastEpochTimeStamp > config.EPOCH_SIZE) {
      config.lastEpochTimeStamp = uint128(block.timestamp); //epochs can be long to allow for dormant periods followed by busy periods
      config.aggregateMintingThisEpoch = 0;
    }

    config.aggregateMintingThisEpoch += amount;
    if (config.aggregateMintingThisEpoch > config.maxMintPerEpoch) {
      revert MaxMintPerEpochExceeded(config.maxMintPerEpoch, config.aggregateMintingThisEpoch);
    }
    mintConfig = config;
    _mint(recipient, amount);
    return true;
  }

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal override {
    uint256 senderBalance = _balances[sender];
    if (amount == 0) return;
    if (senderBalance < amount) {
      revert TransferUnderflow(senderBalance, 0, amount);
    }
    unchecked {
      _balances[sender] = senderBalance - amount;
      _balances[recipient] += amount;
    }

    emit Transfer(sender, recipient, amount);
  }
}

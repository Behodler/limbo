// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract LimboDAOLike {
    function approveFlanMintingPower(address minter, bool enabled)
        public
        virtual;

    function makeProposal(address proposal, address proposer) public virtual;
}

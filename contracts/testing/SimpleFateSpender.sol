// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../facades/LimboDAOLike.sol";

contract SimpleFateSpender {
    LimboDAOLike dao;

    constructor(address _dao){
        dao = LimboDAOLike(_dao);
    }

    function reduceBalance(address owner) public {
        (,uint balance, ) = dao.fateState(owner);
        uint newBalance = balance/2;

        dao.transferFate(owner,address(0),newBalance);
    }

    function transfer(address owner, address recipient, uint amount) public {
        dao.transferFate(owner,recipient,amount);
    }
}
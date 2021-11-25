// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./DAO/Governable.sol";

/*
Exotic tokens may cause Limbo to act unpredictably. The token type that inspired the writing of this class is rebase token in particular.
Since Limbo keeps track of balances, a token who's balance changes dynamically will fall our of sync with Limbo balances.
By using a proxy token, we can neutralize balance changes within limbo wihtout changing Limbo code.
Then on migration, mogorth migration power can consult the registry and the underlying base token can be migrated to Behodler rather than the proxy.
However, it may be that we want to keep the proxy protection for behodler for similar reasons. So we set migrateBaseToBehodler as a configurable variable.
*/
contract TokenProxyRegistry is Governable {
    struct TokenConfig{
        address baseToken;
        bool migrateBaseToBehodler;
    }
    mapping (address=>TokenConfig) public tokenProxy;

    constructor (address dao) Governable(dao){

    }

    function setProxy (address baseToken, address proxy, bool migrateBase) public onlySuccessfulProposal {
        tokenProxy[proxy] = TokenConfig(baseToken, migrateBase);
    }
}
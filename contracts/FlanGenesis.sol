// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./facades/AngbandLike.sol";
import "./facades/FlanLike.sol";
// import "./facades/AddTokenToBehodlerPowerLike.sol";

/**@notice to C4 auditors: this part of Limbo intersects with MorgothDAO and is beyond the scope of the audit.
* No prizes are offered for auditing MorgothDAO at this stage. While it's important that Flan be set up correctly, an incorrect setup
* is easy to detect and costless to discard (ignoring gas costs) and so may be attempted multiple times until perfected. 
* The migration to Behodler will require a surface level understanding of Morgoth but a deep audit is not required there either as Limbo is not the first 
* use of Morgoth.
*/
///@dev this contract combines multiple genesis operations into one transaction to protect against invalid states
contract FlanGenesis{
    struct Dependencies {
        uint something;
    }    
}
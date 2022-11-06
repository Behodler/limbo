Last updated 5 November
# RealEcosystem
A perfect testnet environment will have the real behodler ecosystem contracts, not lite versions. The RealEcosytem folder is an attempt to create a perfect ecosystem representation of Limbo so that the testnet can reflect real chain realities AND so that the script can be used to deploy to more than one chain.

Each directory in contracst/periphery/RealEcosystem represents an aspect of the Behodler ecosystem that Limbo relies on existing. Each part was initially deployed under a lower version of solidity and so some changes are made:
    1. Solidity versions brought to same version of Limbo. Breaking upgrades to solidity attended to. Example uint(-1) becomes type(uint).max
    2.  Name collisions have to be resolved. contracts like PyroToken appear in many places. Thankfully, a hardhat tool which flattens ABIS into one directory cannot tolerate name collisions. So on every compile, the final step is to flatten the ABIs and this step fails while there are duplicates.
    Many conflicts are interfaces like IERC20. So the code is changed in those places to all reference the same IERC20.sol in the openzeppelin directory. Where real contract name collisions happen, the newest most complete version is given precedence. Such as PyroToken V3 will be PyroToken and prior versions will be V2 as an example. Finally where a contract in BehodlerLite conflicts with Behodler in RealEcosystem, Behodler Real wins and the BehodlerLite instance is deleted.

No logic has been changed for obvious reasons. SafeMath has been removed as modern solidity no longer requires it. It is left intact in Uniswap.

# Code Quality
Named imports to prevent polluting the global namespace have being used where appropriate.

# Not in this commit
Update to deployment script to replace Lite versions
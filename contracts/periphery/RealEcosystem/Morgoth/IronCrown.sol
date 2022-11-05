// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./Powers.sol";
import "../../../facades/Burnable.sol";

contract IronCrown is Empowered {
    Burnable public scx;
    struct Silmaril {
        uint16 percentage; //0-1000
        address exit;
    }

    uint8 public constant perpetualMining = 0; //liquid vault etc
    uint8 public constant dev = 1;
    uint8 public constant treasury = 2; //angband

    Silmaril[3] silmarils;

    constructor(address _powers) {
        powersRegistry = PowersRegistry(_powers);
        initialized = true;
        silmarils[treasury].percentage = 750; //to start with treasury gets everything until we have a liquid vault. Then we can divide things up
        silmarils[treasury].exit = msg.sender;
        address devAddress = powersRegistry.minionUser("Melkor");

        silmarils[dev].percentage = 250; //"cannot I have some shoes" - C&C generals peasant
        silmarils[dev].exit = devAddress;
    }

    function setSCX(address _scx) public onlyOwner {
        scx = Burnable(_scx);
    }

    function settlePayments() public {
        uint256 balance = scx.balanceOf(address(this));
        if (balance == 0) return;
        for (uint8 i = 0; i < 3; i++) {
            Silmaril memory silmaril = silmarils[i];
            uint256 share = (balance * silmaril.percentage) / 1000;
            if (address(silmaril.exit) == address(0)) {
                scx.burn(share);
            } else {
                scx.transfer(silmaril.exit, share);
            }
        }
    }

    function setSilmaril(
        uint8 index,
        uint16 percentage,
        address exit
    ) external onlyOwner {
        require(index < 3, "MORGOTH: index out of bounds");
        settlePayments();
        silmarils[index].percentage = percentage;
        require(
            silmarils[0].percentage +
                silmarils[1].percentage +
                silmarils[2].percentage <=
                1000,
            "MORGOTH: percentage exceeds 100%"
        );
        silmarils[index].exit = exit;
    }

    function getSilmaril(uint8 index) external view returns (uint16, address) {
        return (silmarils[index].percentage, silmarils[index].exit);
    }
}

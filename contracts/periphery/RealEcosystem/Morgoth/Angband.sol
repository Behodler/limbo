// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./Powers.sol";
import "./Thangorodrim.sol";
import "../../../openzeppelin/Ownable.sol";
import "./IronCrown.sol";
import "../../../openzeppelin/IERC20.sol";

contract Angband is Empowered, Thangorodrim {
    event EmergencyShutdownTriggered(address newOwner);
    uint256 emergencyCoolDownPeriod;
    address deployer;
    mapping(address => bool) public authorizedInvokers;
    IronCrown public ironCrown;

    constructor(address _powers) {
        powersRegistry = PowersRegistry(_powers);
        _setAddress("POWERREGISTRY", _powers);
        deployer = msg.sender;
        emergencyCoolDownPeriod = block.timestamp + 66 days;
        ironCrown = new IronCrown(_powers);
        _setAddress(IRON_CROWN, address(ironCrown));
        initialized = true;
    }

    function resetEmergencyCooldownPeriod(uint256 daysFromNow)
        public
        requiresPower(powersRegistry.WIRE_ANGBAND())
    {
        emergencyCoolDownPeriod = block.timestamp + daysFromNow * (1 days);
    }

    function finalizeSetup() public {
        _setAddress(ANGBAND, address(this));
    }

    modifier ensureOwnershipReturned(address powerInvoker) {
        _;
        (, bytes32 domain, , ) = PowerInvoker(powerInvoker).power();
        address ownable = getAddress(domain);

        require(
            ownable == address(this) ||
                Ownable(ownable).owner() == address(this),
            "MORGOTH: power invoker failed to return ownership"
        );
    }

    function authorizeInvoker(address invoker, bool authorized)
        public
        requiresPower(powersRegistry.AUTHORIZE_INVOKER())
    {
        authorizedInvokers[invoker] = authorized;
    }

    function setPowersRegistry(address _powers)
        public
        requiresPower(powersRegistry.WIRE_ANGBAND())
    {
        powersRegistry = PowersRegistry(_powers);
        _setAddress(POWERREGISTRY, _powers);
    }

    function mapDomain(address location, bytes32 domain)
        public
        requiresPower(powersRegistry.WIRE_ANGBAND())
    {
        require(
            domain == "ANGBAND" || Ownable(location).owner() == address(this),
            "MORGOTH: transfer domain ownership."
        );
        _setAddress(domain, location);
    }

    function relinquishDomain(bytes32 domain)
        public
        requiresPower(powersRegistry.WIRE_ANGBAND())
    {
        address domainContract = getAddress(domain);
        Ownable(domainContract).transferOwnership(msg.sender);
    }

    function setBehodler(address behodler, address lachesis)
        public
        requiresPower(powersRegistry.POINT_TO_BEHODLER())
    {
        address self = address(this);
        _setAddress(BEHODLER, behodler);
        _setAddress(LACHESIS, lachesis);
        require(
            Ownable(behodler).owner() == self,
            "MORGOTH: transfer Behodler ownership to Angband"
        );
        require(
            Ownable(lachesis).owner() == self,
            "MORGOTH: transfer Lachesis ownership to Angband"
        );
        ironCrown.setSCX(behodler);
    }

    function executePower(address powerInvoker)
        public
        ensureOwnershipReturned(powerInvoker)
        requiresPowerOnInvocation(powerInvoker)
    {
        require(
            authorizedInvokers[powerInvoker],
            "MORGOTH: Invoker not whitelisted"
        );
        PowerInvoker invoker = PowerInvoker(powerInvoker);
        (, bytes32 domain, , ) = invoker.power();
        address domainContract = getAddress(domain);
        Ownable ownable = Ownable(domainContract);
        address self = address(this);
        require(
            domainContract == address(this) || ownable.owner() == address(this),
            "MORGOTH: Transfer domain to Angband before using it"
        );
        if (domainContract != self) ownable.transferOwnership(powerInvoker);
        bytes32 minion = powersRegistry.userMinion(msg.sender);
        PowerInvoker(powerInvoker).invoke(minion, msg.sender);
    }

    //temporary function to allow deployer to wrest control back from Angband in case of bugs or vulnerabilities
    function executeOrder66() public requiresPower(powersRegistry.ORDER66()) {
        require(
            block.timestamp <= emergencyCoolDownPeriod,
            "MORGOTH: Emergency shutdown powers have expired. Angband is forever."
        );
        address behodler = getAddress(BEHODLER);
        address lachesis = getAddress(LACHESIS);

        Ownable(behodler).transferOwnership(deployer);
        Ownable(lachesis).transferOwnership(deployer);
        emit EmergencyShutdownTriggered(deployer);
    }

    function withdrawSCX(uint256 amount)
        public
        requiresPower(powersRegistry.TREASURER())
    {
        ironCrown.settlePayments();
        address scx = getAddress(BEHODLER);
        IERC20(scx).transfer(msg.sender, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./PyroToken.sol";
import * as Snuffer from "./facades/SnufferCap.sol";
import "../../../openzeppelin/Ownable.sol";
import "../../../facades/LachesisLike.sol";
import "../../../openzeppelin/IERC20.sol";
import "../../../facades/BigConstantsLike.sol";
import * as PH from "./ProxyHandler.sol";
import "hardhat/console.sol";

library Create2 {
    /**
     * @dev Deploys a contract using `CREATE2`. The address where the contract
     * will be deployed can be known in advance via {computeAddress}. Note that
     * a contract cannot be deployed twice using the same salt.
     */
    function deploy(bytes32 salt, bytes memory bytecode)
        internal
        returns (address)
    {
        address addr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        if (addr == address(0)) {
            revert Error.Create2Failed();
        }
        return addr;
    }

    /**
     * @dev Returns the address where a contract will be stored if deployed via {deploy}. Any change in the `bytecode`
     * or `salt` will result in a new destination address.
     */
    function computeAddress(bytes32 salt, bytes memory bytecode)
        internal
        view
        returns (address)
    {
        return computeAddress(salt, bytecode, address(this));
    }

    /**
     * @dev Returns the address where a contract will be stored if deployed via {deploy} from a contract located at
     * `deployer`. If `deployer` is this contract's address, returns the same value as {computeAddress}.
     */
    function computeAddress(
        bytes32 salt,
        bytes memory bytecodeHash,
        address deployer
    ) internal pure returns (address) {
        bytes32 bytecodeHashHash = keccak256(bytecodeHash);
        bytes32 _data = keccak256(
            abi.encodePacked(bytes1(0xff), deployer, salt, bytecodeHashHash)
        );
        return address(bytes20(_data << 96));
    }
}

/**
 * @author Justin Goro
 * For every swap and liquidity addition on Behodler AMM, a % of the input token is either burnt or sent to LiquidityReceiverV2.
 * The LiquidityReceiverV2 is responsible for creating and configuring PyroTokens and for distributing fee revenue to them.
 *@title LiquidityReceiverV2
 *@dev owner is MorgothDao
 */
contract LiquidityReceiver is Ownable {
     bool public constant REAL = true;
    /**
     *@param pyroToken address of new PyroToken
     *@param baseToken address of underlying base token
     *@param name of new PyroToken
     *@param symbol of new PyroToken
     */
    event PyroTokenDeployed(
        address pyroToken,
        address baseToken,
        string name,
        string symbol
    );

    struct Configuration {
        LachesisLike lachesis; //Token approval contract on Behodler AMM
        Snuffer.SnufferCap snufferCap;
        address defaultLoanOfficer;
        address proxyHandler;
    }

    Configuration public config;

    BigConstantsLike public immutable bigConstants;
    modifier onlySnufferCap() {
        if (msg.sender != address(config.snufferCap)) {
            revert Error.SnufferCapExpected(address(config.snufferCap), msg.sender);
        }
        _;
    }

    constructor(address _lachesis, address bigConstantsAddress) {
        config.lachesis = LachesisLike(_lachesis);
        config.proxyHandler = address(new PH.ProxyHandler());
        bigConstants = BigConstantsLike(bigConstantsAddress);
    }

    /**
     *@notice SnufferCap sets the rules for fee exemption. It could be a simple whitelist or a fee based system.
     * Fee exemption is meant to help certain usecases for PyroTokens remain valid. For instance, a dapp that stakes their protocol token in PyroTokens for yield may not be sustainable
     *in the short run if the exit fee applies
     *@param snufferCap address of snufferCap compliant contract
     */
    function setSnufferCap(address snufferCap) public onlyOwner {
        config.snufferCap = Snuffer.SnufferCap(snufferCap);
    }

    /** @notice newly deployed PyroTokens are seeded with the defaultLoan officer.
     *@param officer LoanOfficer
     */
    function setDefaultLoanOfficer(address officer) public onlyOwner {
        config.defaultLoanOfficer = officer;
    }

    /**
     *@notice PyroTokens can pull their accrued trade revenue from Behodler.
     *@dev anyone can call this function because there is no downside, security or otherwise
     *@param baseToken is the Behodler listed token
     */
    function drain(address baseToken) external returns (uint256) {
        address pyroToken = getPyroToken(baseToken);
        IERC20 reserve = IERC20(baseToken);
        uint256 amount = reserve.balanceOf(address(this));
        reserve.transfer(pyroToken, amount);
        return amount;
    }

    /**@notice on mint PyroTokens can pull pending trade revenue from Behodler AMM to increase reserves.
    @param pyroToken contract address of pyroToken
    @param pull if true, pyroToken pulls revenue on every mint
     */
    function togglePyroTokenPullFeeRevenue(address pyroToken, bool pull)
        public
        onlyOwner
    {
        PyroToken(pyroToken).togglePullPendingFeeRevenue(pull);
    }

    /**
     *@notice sets the loan officer for a specific pyroToken.
     *@param pyroToken address of pyroToken
     *@param loanOfficer contract which determines loan logic
     */
    function setPyroTokenLoanOfficer(address pyroToken, address loanOfficer)
        public
        onlyOwner
    {
        PyroToken(pyroToken).setLoanOfficer(loanOfficer);
    }

    /**@notice Lacheis is the Behodler AMM contract which determines if a token should have a pyroToken
     *@param _lachesis address of Lachesis token gatekeeper
     */
    function setLachesis(address _lachesis) public onlyOwner {
        config.lachesis = LachesisLike(_lachesis);
    }

    /**
     *@notice Specific contracts can be exempt from certain fees such as exit fee
     *@param pyroToken address of PyroToken
     *@param target contract receiving fee exemption
     *@param exemption from an Enum of every type of exemption.
     */
    function setFeeExemptionStatusOnPyroForContract(
        address pyroToken,
        address target,
        FeeExemption exemption
    ) public onlySnufferCap {
        if (!isContract(target)) {
            revert Error.OnlyContracts(target);
        }
        PyroToken(pyroToken).setFeeExemptionStatusFor(target, exemption);
    }

    /**
     *@notice deploys a new pyroToken contract
     *@param baseToken is the BehodlerListed token
     *@param name extended ERC20 name
     *@param symbol extended ERC20 symbol.
     */
    function registerPyroToken(
        address baseToken,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public onlyOwner {
        console.log('executing in registerPyroToken');
        address expectedAddress = getPyroToken(baseToken);

        //Don't be mislead by the name. The purpose of this is just to check if there is a contract deployed at the current address
        if (isContract(expectedAddress)) {
            revert Error.AddressOccupied(expectedAddress);
        }
        
        //Behodler has rules for which tokens can be registered as a PyroToken: Valid and not burnable.
        (bool valid, bool burnable) = config.lachesis.cut(baseToken);

        if (!valid || burnable) {
            revert Error.LachesisValidationFailed(baseToken, valid, burnable);
        }

        //Using a salted address lets us predict where each PyroToken will be deployed.
        address p = Create2.deploy(
            keccak256(abi.encode(baseToken)),
            bigConstants.PYROTOKEN_BYTECODE()
        );
        PyroToken(p).initialize(
            baseToken,
            name,
            symbol,
            decimals,
            address(bigConstants),
            config.proxyHandler
        );
        PyroToken(p).setLoanOfficer(config.defaultLoanOfficer);

        if (p != expectedAddress) {
            revert Error.AddressPredictionInvariant(p, expectedAddress);
        }
        emit PyroTokenDeployed(p, baseToken, name, symbol);
    }

    /**@notice migration of a PyroToken contract to new LiquidityReceiverV2
     *@param pyroToken pyroToken to be migrated
     *@param receiver new LiquidityReceiverV2
     */
    function transferPyroTokenToNewReceiver(address pyroToken, address receiver)
        public
        onlyOwner
    {
        PyroToken(pyroToken).transferToNewLiquidityReceiver(receiver);
    }

    //by using salted deployments (CREATE2), we get a cheaper version of mapping by not having to hit an SLOAD op
    function getPyroToken(address baseToken) public view returns (address) {
        bytes32 salt = keccak256(abi.encode(baseToken));
        return Create2.computeAddress(salt, bigConstants.PYROTOKEN_BYTECODE());
    }

    function isContract(address addr) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}

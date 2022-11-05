// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../facades/Enums.sol";
import "../../../openzeppelin/SafeERC20.sol";
import * as RG from "./facades/ReentrancyGuard.sol";
import "../../../facades/BigConstantsLike.sol";
import * as Error from "./Errors.sol";
import * as LR from "../../../facades/LiquidityReceiverLike.sol";
// import "hardhat/console.sol";

/**
 *@title PyroToken
 *@author Justin Goro
 *@notice PyroTokens are ERC20 tokens that wrap and add burn incentives to standard ERC20 tokens traded on Behodler. They can be redeemed for base tokens.
 The mapping is 1:1 where each token has a corresponding PyroToken. For instance, Weth only has PyroWeth and PyroWeth only redeems for Weth.
 Not all tokens traded on Behodler can be wrapped as PyroTokens but that rule is beyond the scope of this repository.
 at an algorithmic redeem rate: r = R/T where R is the reserve of base tokens and T is the total supply of PyroTokens.
 When Pyrotokens burn, T declines, independently. R can never fall without T falling by the correct ratio. Putting this together
 means the Pyrotoken redeem rate (r) can never fall.
    Sources of R change: minting with base token, redeeming for base token and fee revenue from Behodler AMM when the base token is sold into Behdoler AMM
    Soures of T change: burn on transfer and redemption exit fee (2%) 
 At the governance level, contract addresses can be made exempt from paying burn fees through special gatekeeper contracts called snuffer caps.
 *@dev Each PyroToken is deployed as a standalone contract and they all link back to the same LiquidityReceiverV2 contract.
 */

abstract contract PyroERC20 is IERC20 {
    mapping(address => uint256) internal _balances;

    mapping(address => mapping(address => uint256)) internal _allowances;

    uint256 internal _totalSupply;

    string internal _name;
    string internal _symbol;
    uint8 internal _decimals;

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses, unless this function is
     * overridden;
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return _decimals == 0 ? 18 : _decimals;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev Moves `amount` of tokens from `sender` to `recipient`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual;

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        uint256 accountBalance = _balances[account];
        if (accountBalance < amount) {
            revert InsufficinetFunds(accountBalance, amount);
        }
        unchecked {
            _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) public virtual {
        _burn(msg.sender, amount);
    }
}


contract PyroToken is PyroERC20, RG.ReentrancyGuard {
    using SafeERC20 for IERC20;
    /**
     *@param loanOfficer address of new loan officer contract
     */
    event LoadOfficerAssigned(address indexed loanOfficer);

    /**
     *@param borrower of base token
     *@param baseTokenBorrowed final amount borrowed, not change
     *@param pyroTokenStaked final amount staked, not change
     *@param rate redeem rate at the time of adjustment
     */
    event LoanObligationSet(
        address borrower,
        uint256 baseTokenBorrowed,
        uint256 pyroTokenStaked,
        uint256 rate,
        uint256 slashBasisPoints
    );

    struct Configuration {
        address liquidityReceiver;
        IERC20 baseToken;
        address loanOfficer;
        bool pullPendingFeeRevenue;
    }
    struct DebtObligation {
        uint256 base;
        uint256 pyro;
        uint256 redeemRate;
        uint256 lastUpdated;
    }
    address public rebaseWrapper;
    uint256 public aggregateBaseCredit;
    Configuration public config;
    uint256 private constant ONE = 1 ether;

    /** @notice
    Exemptions aren't a form of cronyism. Rather, it will be decided on fair, open cryptoeconomic rules to allow protocols that need to
    frequently work with pyroTokens to be able to do so without incurring untenable cost to themselves. Always bear in mind that the big
    AMMs including Behodler will burn PyroTokens with abandon and without exception.
    We don't need every single protocol to bear the cost of Pyro growth and would 
    prefer to hit the high volume bots where they benefit most.
    Regarding fair cryptoeconomic incentives, a contract that requires burning a certain level of EYE would be a good example though we may get more sophisticated than that. 
    As a pertinent example, since Behodler burns as a primitive, 
    if we list a pyroToken for trade as burnable, then the total fee will be the Behodler burn fee plus the incoming transfer burn as well as the outgoing transfer burn when it is bought.
    This might be a little too much burning. In this case, we can turn of the transfer burns and still get the pyroToken burning on sale.  
    */
    mapping(address => FeeExemption) public feeExemptionStatus;

    /**@notice By separating logic (loan officer) from state(debtObligations), we can upgrade the loan system without requiring existing borrowers migrate.
     *Seamless upgrade. This allows for better loan logic to replace the initial version.
     *By mapping debt on an individual pyroToken basis, it means each pyroToken can have it's own loan system. Potentially creating
     *a flourising of competing ideas. Seasteading for debt.
     **/
    mapping(address => DebtObligation) public debtObligations;

    /**@dev LiquidityReceiverV2 subscribes the PyroToken to trade revenue from the Behodler AMM. It's a pull based feed.
     * Behodler sends fee to LiquidityReceiverV2. Corresponding PyroToken pulls the accumulated fees on mint, before calculating the minted value
     */
    constructor() {
        config.liquidityReceiver = msg.sender;
        config.pullPendingFeeRevenue = true;
    }

    modifier initialized() {
        if (address(config.baseToken) == address(0)) {
            revert Error.BaseTokenNotSet(address(this));
        }
        _;
    }

    modifier onlyReceiver() {
        _onlyReceiver();
        _;
    }

    function _onlyReceiver() internal view {
        if (msg.sender != config.liquidityReceiver) {
            revert Error.OnlyReceiver(config.liquidityReceiver, msg.sender);
        }
    }

    function _updateReserve() internal {
        if (config.pullPendingFeeRevenue) {
            LR.LiquidityReceiverLike(config.liquidityReceiver).drain(
                address(config.baseToken)
            );
        }
    }

    modifier updateReserve() {
        _updateReserve();
        _;
    }

    modifier onlyLoanOfficer() {
        if (msg.sender != config.loanOfficer) {
            revert Error.OnlyLoanOfficer(config.loanOfficer, msg.sender);
        }
        _;
    }

    /**
     * @dev since the constructor is invoked in a low level setting with no static typing, the initialization logic
     * has been separated out into the initalize function to benefit from static typing.
     * @param baseToken for this pyrotoken
     * @param name_ the ERC20 name of the Pyrotoken
     * @param symbol_ the ERC20 symbol of the Pyrotoken
     */
    function initialize(
        address baseToken,
        string memory name_,
        string memory symbol_,
        uint8 decimals,
        address bigConstantsAddress,
        address proxyHandler
    ) external onlyReceiver {
        config.baseToken = IERC20(baseToken);
        _name = name_;
        _symbol = symbol_;
        decimals = decimals;
        rebaseWrapper = BigConstantsLike(bigConstantsAddress)
            .deployRebaseWrapper(address(this));

        //disable all fees so that holders can toggle back and forth without penalty
        feeExemptionStatus[rebaseWrapper] = FeeExemption
            .REDEEM_EXEMPT_AND_SENDER_EXEMPT_AND_RECEIVER_EXEMPT;

        //disable all fees for the proxyHandler
        feeExemptionStatus[proxyHandler] = FeeExemption
            .SENDER_EXEMPT_AND_RECEIVER_EXEMPT;
    }

    /**
     * @notice PyroLoans logic is governed by a loan officer contract
     * @param loanOfficer the address of the loan officer
     */
    function setLoanOfficer(address loanOfficer) external onlyReceiver {
        config.loanOfficer = loanOfficer;
    }

    /**
     * @notice On mint, the pyrotoken can pull any pending revenue collected from Behodler
     * @param pullPendingFeeRevenue true if yes, false if no
     */
    function togglePullPendingFeeRevenue(bool pullPendingFeeRevenue)
        external
        onlyReceiver
    {
        config.pullPendingFeeRevenue = pullPendingFeeRevenue;
    }

    /**
     *@notice contract addresses can be be made exempt from paying different type of fees.
     *@param exempt the contract to be made exempt
     *@param status type of fee exemption to be made. Eg. exit fee
     */
    function setFeeExemptionStatusFor(address exempt, FeeExemption status)
        external
        onlyReceiver
    {
        feeExemptionStatus[exempt] = status;
    }

    /**
     * @notice in the event of a liquidityReceiver upgrade
     * @param liquidityReceiver the new liquidityReceiver address
     */
    function transferToNewLiquidityReceiver(address liquidityReceiver)
        external
        onlyReceiver
    {
        if (liquidityReceiver == address(0)) {
            revert Error.AddressNonZero();
        }
        config.liquidityReceiver = liquidityReceiver;
    }

    /**
     * @notice Mints PyroTokens from base tokens
     * @param amount the amount of base tokens to transfer from sender
     * @param recipient the recipient of the newly minted tokens
     * @return minted quantity of pyrotokens minted
     */
    function mint(address recipient, uint256 amount)
        public
        updateReserve
        initialized
        returns (uint256 minted)
    {
        //redeemRate() is altered by a change in the reserves and so must be captured before hand.
        uint256 _redeemRate = redeemRate();
        IERC20 baseToken = config.baseToken;

        //fee on transfer token safe
        uint256 balanceBefore = baseToken.balanceOf(address(this));
        baseToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 changeInBalance = baseToken.balanceOf(address(this)) -
            balanceBefore;

        //r = R/T where r is the redeem rate, R is the base token reserve and T is the PyroToken supply.
        // This says that 1 unit of this PyroToken is worth r units of base token.
        //=> 1 pyroToken = 1/r base tokens
        //=> pyroTokens minted = base_token_amount * 1/r
        minted = (changeInBalance * ONE) / _redeemRate;
        _mint(recipient, minted);
    }

    /**@notice redeems base tokens for a given pyrotoken amount at the current redeem rate
    @param recipient recipient of the redeemed base tokens
    @param amount of pyroTokens to transfer from recipient
     */
    function redeem(address recipient, uint256 amount)
        external
        returns (uint256)
    {
        return _redeem(recipient, msg.sender, amount);
    }

    /**
     * @notice Current rate at which 1 pyrotoken can redeem for (return value) base tokens.
     * Until a pyroloan is defaulted on, the lent out baseToken isn't considered lost. The redeem rate takes it into account.
     * If the loan defaults, the corresponding staked pyro is burnt so that the redeem rate isn't left unbalanced because the staked pyrotoken is burnt,
     * matching credit and debit.
     */
    function redeemRate() public view returns (uint256) {
        uint256 ts = _totalSupply;
        if (ts == 0) return ONE;

        return
            ((config.baseToken.balanceOf(address(this)) + aggregateBaseCredit) *
                ONE) / (ts);
    }

    /**@notice Standard ERC20 transfer
     *@dev PyroToken fee logic implemented in _transfer
     *@param recipient the recipient of the token
     *@param amount the amount of tokens to transfer
     */
    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**@notice Standard ERC20 transferFrom
     *@dev PyroToken fee logic implemented in _transfer
     *@param sender the sender of the token
     *@param recipient the recipient of the token
     *@param amount the amount of tokens to transfer
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = _allowances[sender][msg.sender];

        if (
            currentAllowance != type(uint256).max && msg.sender != rebaseWrapper
        ) {
            if (currentAllowance < amount) {
                revert AllowanceExceeded(currentAllowance, amount);
            }
            unchecked {
                _approve(sender, msg.sender, currentAllowance - amount);
            }
        }

        return true;
    }

    /**
     *@notice debt accounting function. The DAO approved loan officer (a contract) sets the debt obligation for a borrower.
     * The loan officer can build in any form of debt complexity. For example, the amortization rate bonding curve outlined in the white paper (README.md)
     * @dev keep in mind that msg.sender is the loan officer contract.
     *@param borrower EOA or contract that is borrowing base token from reserve of address(this)
     *@param baseTokenBorrowed Final borrowed position of base tokens for borrower.
     *@param pyroTokenStaked Final staked balance for borrower.
     *@param slashBasisPoints for liquidations, staked pyro can be burnt.
     */
    function setObligationFor(
        address borrower,
        uint256 baseTokenBorrowed,
        uint256 pyroTokenStaked,
        uint256 slashBasisPoints
    ) external onlyLoanOfficer nonReentrant returns (bool success) {
        if (slashBasisPoints > 10000) {
            revert Error.SlashPercentageTooHigh(slashBasisPoints);
        }
        DebtObligation memory currentDebt = debtObligations[borrower];
        uint256 rate = redeemRate();

        uint256 minPyroStake = (baseTokenBorrowed * ONE) / rate;
        if (pyroTokenStaked < minPyroStake) {
            revert Error.UnsustainablePyroLoan(pyroTokenStaked, minPyroStake);
        }

        debtObligations[borrower] = DebtObligation(
            baseTokenBorrowed,
            pyroTokenStaked,
            rate,
            block.timestamp
        );

        //netStake > 0 is deposit and < 0 is withdraw
        int256 netStake = int256(pyroTokenStaked) - int256(currentDebt.pyro);
        uint256 stake;
        uint256 borrowerPyroBalance = _balances[borrower];
        if (netStake > 0) {
            stake = uint256(netStake);

            if (borrowerPyroBalance < stake) {
                revert Error.StakeFailedInsufficientBalance(
                    borrowerPyroBalance,
                    stake
                );
            }
            unchecked {
                //A DAO approved LoanOfficer does not require individual holder approval.
                //Staking is not subject to transfer fees.
                _balances[borrower] -= stake;
            }
            //Staked Pyro stored on own contract. Not in unchecked in case Pyro wraps a hyperinflationary token.
            _balances[address(this)] += stake;
        } else if (netStake < 0) {
            stake = uint256(-netStake);
            uint256 netReceipt = ((10000 - slashBasisPoints) * stake) / 10000;

            if (slashBasisPoints > 0) {
                //burn pyrotoken
                _totalSupply -= stake - netReceipt;
            }
            _balances[borrower] += netReceipt;
            _balances[address(this)] -= stake;
        }

        //netBorrowing > 0, staker is borrowing, <0, staker is paying down debt.
        int256 netBorrowing = int256(baseTokenBorrowed) -
            int256(currentDebt.base);
        if (netBorrowing > 0) {
            aggregateBaseCredit += uint256(netBorrowing);
            config.baseToken.safeTransfer(borrower, uint256(netBorrowing));
        } else if (netBorrowing < 0) {
            uint256 absoluteBorrowing = uint256(-netBorrowing);
            aggregateBaseCredit -= absoluteBorrowing;
            config.baseToken.safeTransferFrom(
                borrower,
                address(this),
                absoluteBorrowing
            );
        }
        emit LoanObligationSet(
            borrower,
            baseTokenBorrowed,
            pyroTokenStaked,
            rate,
            slashBasisPoints
        );
        success = true;
    }

    /**
     *@notice calculates the exemption adjusted transfer fee, depending on both the sender and receiver exemptions.
     *@param amount transfer amount
     *@param sender of pyroToken
     *@param receiver of pyroToken
     */
    function calculateTransferFee(
        uint256 amount,
        address sender,
        address receiver
    ) public view returns (uint256) {
        uint256 senderStatus = uint256(feeExemptionStatus[sender]);
        uint256 receiverStatus = uint256(feeExemptionStatus[receiver]);
        if (
            (senderStatus >= 1 && senderStatus <= 4) ||
            (receiverStatus == 2 ||
                (receiverStatus >= 4 && receiverStatus <= 6))
        ) {
            return 0;
        }
        return amount / 1000;
    }

    /**
     *@notice calculates the exemption adjusted redemption fee, depending on redeemer exemptions.
     *@param amount transfer amount
     *@param redeemer of pyroToken for underlying base token
     */
    function calculateRedemptionFee(uint256 amount, address redeemer)
        public
        view
        returns (uint256)
    {
        uint256 status = uint256(feeExemptionStatus[redeemer]);
        if (status > 2 && status != 5) return 0;
        return (amount << 1) / 100;
    }

    function _redeem(
        address recipient,
        address owner,
        uint256 amount
    ) internal updateReserve returns (uint256) {
        uint256 _redeemRate = redeemRate();
        _balances[owner] -= amount;
        uint256 fee = calculateRedemptionFee(amount, owner);

        uint256 net = amount - fee;
        //r = R/T where r is the redeem rate, R is the base token reserve and T is the PyroToken supply.
        // This says that 1 unit of this PyroToken is worth r units of base token.
        //
        //=> base_tokens_redeemed = r * (pyrotoken_amount - exit_fee)
        uint256 baseTokens = (_redeemRate * net) / ONE;

        _totalSupply -= amount;

        //pyro burn event
        emit Transfer(owner, address(0), amount);

        config.baseToken.safeTransfer(recipient, baseTokens);
        return baseTokens;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        if (recipient == address(0)) {
            burn(amount);
            return;
        }
        uint256 senderBalance = _balances[sender];
        uint256 fee = calculateTransferFee(amount, sender, recipient);

        _totalSupply -= fee;

        uint256 netReceived = amount - fee;
        _balances[sender] = senderBalance - amount;
        _balances[recipient] += netReceived;

        emit Transfer(sender, recipient, amount);
    }
}

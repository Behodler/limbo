// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../facades/Enums.sol";
import "../../../openzeppelin/IERC20.sol";
import "../../../openzeppelin/SafeERC20.sol";
import "../../../facades/PyroTokenLike.sol";
import * as LR from "../../../facades/LiquidityReceiverLike.sol";
import * as Error from "./Errors.sol";

/**
 *@title PyroToken
 *@author Justin Goro
 *@notice RebaseWrappers are tokens that accompany PyroTokens. The price of the rebase token is always 1:1 equal to the baseToken price.
 When the redeem rate rises, this reflects as a higher account balance. RebaseTokens can be converted from their corresponding PyroToken and vice versa.
 There is no fee on transfer for conversion. Transferring a RebaseWrapper reduces incurs a transfer fee which reflects as a burn on the underlying pyroToken.
 *@dev RebaseTokens do not need to ERC20.approve their corresponding pyroToken.
 */
contract RebaseWrapper is IERC20 {
    PyroTokenLike public immutable pyroToken;
    string private _name;
    string private _symbol;

    uint256 private constant ONE = 1e18;

    mapping(address => uint256) internal pyroBalances;
    mapping(address => mapping(address => uint256)) internal _allowances;

    constructor(address pyro) {
        pyroToken = PyroTokenLike(pyro);

        (address receiverAddress, IERC20 baseToken, , ) = pyroToken.config();
        LR.LiquidityReceiverLike receiver = LR.LiquidityReceiverLike(receiverAddress);
        if (
            receiver.getPyroToken(address(baseToken)) != pyro ||
            address(receiver.bigConstants()) != msg.sender
        ) {
            revert Error.InvalidPyroToken();
        }

        _name = string(abi.encodePacked(pyroToken.name(), bytes("_rebase")));
        _symbol = string(
            abi.encodePacked(pyroToken.symbol(), bytes("_rebase"))
        );
    }

    function name() external view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8) {
        return pyroToken.decimals();
    }

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256) {
        return pyroToNative(pyroToken.balanceOf(address(this)));
    }

    /**
    *@param recipient receives the wrapped rebase balance 
    *@param pyroAmount pyroTokens to convert from msg.sender
    */
    function convertFromPyro(address recipient, uint256 pyroAmount)
        public
        returns (bool)
    {
        uint256 balanceBefore = pyroToken.balanceOf(address(this));
        pyroToken.transferFrom(msg.sender, address(this), pyroAmount);
        uint256 amountTransferred = pyroToken.balanceOf(address(this)) -
            balanceBefore;
        pyroBalances[recipient] += amountTransferred;
        return true;
    }

   /**
    *@param recipient receives the unwrapped pyro balance 
    *@param amount rebaseTokens to convert from msg.sender
    */
    function convertToPyro(address recipient, uint256 amount)
        public
        returns (bool)
    {
        uint256 pyroAmount = nativeToPyro(amount);
        pyroBalances[msg.sender] -= pyroAmount;
        pyroToken.transfer(recipient, pyroAmount);
        return true;
    }

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256) {
        return
            (pyroBalances[account] * pyroToken.redeemRate()) / ONE;
    }

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount)
        external
        returns (bool)
    {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
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
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */

    function approve(address spender, uint256 amount)
        public
        virtual
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
    *@param amount rebase tokens to burn
    *@dev underlying pyroTokens are burnt so that redeem rate rises.
     */
    function burn(uint256 amount) public returns (bool) {
        uint256 pyroAmount = nativeToPyro(amount);
        pyroBalances[msg.sender] -= pyroAmount;
        pyroToken.burn(pyroAmount);
        return true;
    }

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external virtual override returns (bool) {
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = _allowances[sender][msg.sender];

        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) {
                revert AllowanceExceeded(currentAllowance, amount);
            }
            unchecked {
                _approve(sender, msg.sender, currentAllowance - amount);
            }
        }

        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        if (recipient == address(0)) {
            burn(amount);
            return;
        }
        uint256 pyroAmount = nativeToPyro(amount);
        uint256 fee = pyroToken.calculateTransferFee(
            pyroAmount,
            sender,
            recipient
        );
        pyroToken.burn(fee);

        pyroBalances[sender] -= pyroAmount;
        pyroBalances[recipient] += pyroAmount - fee;
        emit Transfer(sender, recipient, amount);
    }

    function pyroToNative(uint256 amount) internal view returns (uint256) {
        return (amount * pyroToken.redeemRate()) / ONE;
    }

    function nativeToPyro(uint256 amount) internal view returns (uint256) {
        return ((amount*ONE) / pyroToken.redeemRate());
    }
}

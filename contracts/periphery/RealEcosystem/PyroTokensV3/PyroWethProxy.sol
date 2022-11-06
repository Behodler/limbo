// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../facades/PyroTokenLike.sol";
import "../Behodler/WETH10.sol";
import "../../../openzeppelin/IERC20.sol";
import "../../../openzeppelin/Ownable.sol";
import * as RG from "./facades/ReentrancyGuard.sol";
import * as Error from "./Errors.sol";
/**
 *@author Justin Goro
 *@notice Eth->Weth->PyroWeth and reverse in one tx. Simplifies UI of working with Eth.
 */
contract PyroWethProxy is Ownable, RG.ReentrancyGuard {
     bool public constant REAL = true;
    IWETH10 public weth10;
    uint256 private constant ONE = 1e18;
    PyroTokenLike public pyroWeth;

    constructor(address _pyroWeth) {
        pyroWeth = PyroTokenLike(_pyroWeth);
        (, IERC20 baseToken, , ) = pyroWeth.config();
        weth10 = IWETH10(address(baseToken));
        weth10.approve(_pyroWeth, type(uint256).max);
    }

    /**
     *@notice PyroWeth balance of holder
     *@param holder address of PyroWeth holder
     */
    function balanceOf(address holder) external view returns (uint256) {
        return pyroWeth.balanceOf(holder);
    }

    /**
     *@notice redeems PyroWeth for native token (Eth on mainnet)
     *@param pyroTokenAmount amount of pyrotokens to redeem from msg.sender.
     *@dev Remember to exempt this contract of both transfer and redeem fees
     */
    function redeem(uint256 pyroTokenAmount)
        external
        nonReentrant
        returns (uint256)
    {
        uint balanceBefore = pyroWeth.balanceOf(address(this));
        pyroWeth.transferFrom(msg.sender, address(this), pyroTokenAmount);
        uint change = pyroWeth.balanceOf(address(this)) - balanceBefore;
        require(change == pyroTokenAmount,"transfer fee not exempt");
        pyroWeth.redeem(address(this),pyroTokenAmount);
        uint256 balanceOfWeth = IERC20(weth10).balanceOf(address(this));
        weth10.withdrawTo(payable(msg.sender), balanceOfWeth);
        return balanceOfWeth;
    }

    /**
     *@notice mints PyroWeth from a given amount of native token (ETH on mainnet)
     *@param baseTokenAmount amount of native token to use in minting PyroWeth from msg.sender.
     */
    function mint(uint256 baseTokenAmount)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        if (msg.value != baseTokenAmount || baseTokenAmount == 0) {
            revert Error.EthForwardingFailed(msg.value, baseTokenAmount);
        }
        weth10.deposit{value: msg.value}();
        uint256 weth10Balance = IERC20(weth10).balanceOf(address(this));
        return pyroWeth.mint(msg.sender, weth10Balance);
    }
}

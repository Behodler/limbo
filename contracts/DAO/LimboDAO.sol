// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ERC677/ERC677.sol";
import "../Flan.sol";
import "./ProposalFactory.sol";
import "../facades/SwapFactoryLike.sol";
import "../facades/UniPairLike.sol";

/*
This is the first MicroDAO associated with MorgothDAO. A MicroDAO manages parameterization of running dapps without having 
control over existential functionality. This is not to say that some of the decisions taken are not critical but that the domain
of influence is confined to the local Dapp - Limbo in this case.
 
*/

library TransferHelper {
    function ERC20NetTransfer(
        address token,
        address from,
        address to,
        int256 amount
    ) public {
        if (amount > 0) {
            require(
                IERC20(token).transferFrom(from, to, uint256(amount)),
                "LimboDAO: ERC20 transfer from failed."
            );
        } else {
            require(
                IERC20(token).transfer(to, uint256(amount * (-1))),
                "LimboDAO: ERC20 transfer failed."
            );
        }
    }
}

enum LPType {none, uni, sushi}

enum FateGrowthStrategy {straight, directRoot, IndirectTwoRootEye}

contract LimboDAO is Ownable {
    using TransferHelper for address;
    uint256 constant ONE = 1 ether;

    struct DomainConfig {
        address limbo;
        address flan;
        address eye;
        address fate;
        bool live;
        address sushiFactory;
        address uniFactory;
    }

    struct ProposalConfig {
        uint256 votingDuration;
        uint256 requiredFateStake;
        address proposalFactory; //check this for creating proposals
    }

    struct ProposalState {
        int256 fate;
        bool approved;
        address proposer;
    }

    //rateCrate
    struct FateState {
        uint256 fatePerMinute;
        uint256 fateBalance;
        uint256 lastDamnAdjustment;
    }

    struct AssetClout {
        uint256 fateWeight;
        uint256 balance;
    }

    DomainConfig public domainConfig;
    ProposalConfig public proposalConfig;
    mapping(address => FateGrowthStrategy) public fateGrowthStrategy;
    mapping(address => bool) assetApproved;
    mapping(address => FateState) fateState; //lateDate
    mapping(address => mapping(address => AssetClout)) stakedUserAssetWeight; //user->asset->weight
    mapping(address => LPType) knownLP;
    Proposal public currentProposal;
    ProposalState public currentProposalState;

    modifier isLive {
        require(domainConfig.live, "LimboDAO: DAO is not live. Wen Limbo?");
        _;
    }

    modifier onlySuccessfulProposal {
        require(currentProposalState.approved, "LimboDAO: approve proposal");
        _;
        delete currentProposalState;
    }

    modifier updateCurrentProposal {
        if (address(currentProposal) != address(0)) {
            uint256 durationSinceStart =
                currentProposal.timeProposed() - block.timestamp;
            if (durationSinceStart >= proposalConfig.votingDuration) {
                if (
                    currentProposalState.fate > 0 &&
                    !currentProposalState.approved
                ) {
                    currentProposalState.approved = true;
                    (bool success, ) =
                        address(currentProposal).call(
                            abi.encodeWithSignature("orchestrateExecute()")
                        );
                    if (success)
                        fateState[currentProposalState.proposer]
                            .fateBalance += proposalConfig.requiredFateStake;
                }
            }
        }
        _;
    }

    modifier incrementFate {
        FateState storage state = fateState[_msgSender()];
        state.fateBalance +=
            state.fatePerMinute *
            ((block.timestamp - state.lastDamnAdjustment) / 60);
        _;
    }

    constructor(
        address limbo,
        address flan,
        address eye,
        address proposalFactory,
        address sushiFactory,
        address uniFactory,
        address[] memory sushiLPs,
        address[] memory uniLPs
    ) {
        _seed(limbo, flan, eye, sushiFactory, uniFactory);
        proposalConfig.votingDuration = 2 days;
        proposalConfig.requiredFateStake = 3219938; //50000 EYE for 24 hours
        proposalConfig.proposalFactory = proposalFactory;
        for (uint256 i = 0; i < sushiLPs.length; i++) {
            require(
                UniPairLike(sushiLPs[i]).factory() == sushiFactory,
                "LimboDAO: invalid Sushi LP"
            );
            if (IERC20(eye).balanceOf(sushiLPs[i]) > 1000)
                assetApproved[sushiLPs[i]] = true;
        }
           for (uint256 i = 0; i < uniLPs.length; i++) {
            require(
                UniPairLike(uniLPs[i]).factory() == uniFactory,
                "LimboDAO: invalid Sushi LP"
            );
            if (IERC20(eye).balanceOf(uniLPs[i]) > 1000)
                assetApproved[uniLPs[i]] = true;
        }
    }

    function seed(
        address limbo,
        address flan,
        address eye,
        address sushiFactory,
        address uniFactory
    ) public onlyOwner {
        _seed(limbo, flan, eye, sushiFactory, uniFactory);
    }

    function killDAO(address newOwner) public onlyOwner isLive {
        domainConfig.live = false;
        Ownable(domainConfig.flan).transferOwnership(newOwner);
        Ownable(domainConfig.limbo).transferOwnership(newOwner);
    }

    function makeProposal(address proposal, address proposer)
        public
        updateCurrentProposal
    {
        address sender = _msgSender();
        require(
            sender == proposalConfig.proposalFactory,
            "LimboDAO: only Proposal Factory"
        );
        fateState[proposer].fateBalance -= proposalConfig.requiredFateStake * 2; //TODO: test that overflow check is actuall implemented
        currentProposal = Proposal(proposal);
        currentProposalState.approved = false;
        currentProposalState.fate = 0;
        currentProposalState.proposer = proposer;
    }

    function vote(address proposal, int256 fate)
        public
        updateCurrentProposal
        isLive
    {
        require(
            proposal == address(currentProposal),
            "LimboDAO: stated proposal does not match current proposal"
        );
        require(
            !currentProposalState.approved,
            " LimboDAO: voting on proposal closed"
        );

        fateState[_msgSender()].fateBalance -= proposalConfig.requiredFateStake;
        currentProposalState.fate += fate;
    }

    function setProposalConfig(
        uint256 votingDuration,
        uint256 requiredFateStake,
        address proposalFactory
    ) public onlySuccessfulProposal {
        proposalConfig.votingDuration = votingDuration;
        proposalConfig.requiredFateStake = requiredFateStake;
        proposalConfig.proposalFactory = proposalFactory;
    }

    function stakeEYEBasedAsset(
        uint256 finalAssetBalance,
        uint256 finalEYEBalance,
        uint256 rootEYE,
        address asset
    ) public isLive incrementFate {
        address sender = _msgSender();
        FateGrowthStrategy strategy = fateGrowthStrategy[domainConfig.eye];
        uint256 rootEYESquared = rootEYE**2;
        uint256 rootEYEPlusOneSquared = (rootEYE + 1)**2;
        require(
            rootEYESquared <= finalEYEBalance &&
                rootEYEPlusOneSquared > finalEYEBalance,
            "LimboDAO: Stake EYE invariant."
        );
        require(assetApproved[asset], "LimboDAO: illegal asset");
        //EYE
        if (strategy == FateGrowthStrategy.directRoot) {
            require(
                finalAssetBalance == finalEYEBalance,
                "LimboDAO: staking eye invariant."
            );
            require(asset == domainConfig.eye);
            AssetClout storage clout = stakedUserAssetWeight[sender][asset];
            fateState[sender].fatePerMinute -= clout.fateWeight;
            clout.fateWeight = rootEYE;
            clout.balance = finalAssetBalance;
            fateState[sender].fatePerMinute += rootEYE;

            int256 netBalance =
                int256(finalAssetBalance) - int256(clout.balance);

            domainConfig.eye.ERC20NetTransfer(
                sender,
                address(this),
                netBalance
            );
        } else if (strategy == FateGrowthStrategy.IndirectTwoRootEye) {
            //LP
            AssetClout storage clout = stakedUserAssetWeight[sender][asset];
            fateState[sender].fatePerMinute -= clout.fateWeight;
            clout.fateWeight = 2 * rootEYE;
            fateState[sender].fatePerMinute+=clout.fateWeight;

            uint256 actualEyeBalance =
                IERC20(domainConfig.eye).balanceOf(asset) * ONE;
            uint totalSupply = IERC20(asset).totalSupply();
            uint eyePerUnit = actualEyeBalance/totalSupply;
            uint impliedEye = (eyePerUnit * finalAssetBalance)/ONE;
            require(finalEYEBalance == impliedEye, "LimboDAO: stake invariant check 2.");
            clout.balance = finalAssetBalance;
            fateState[sender].fatePerMinute += 2 * rootEYE;
        }
    }

    //TODO: test that this isn't lost when updateState is called.
    function burnEYE(uint256 amount) public isLive incrementFate {
        fateState[_msgSender()].fateBalance += amount * 10;
        ERC677(domainConfig.eye).burn(amount);
    }

    function approveFlanMintingPower(address minter, bool enabled)
        public
        onlySuccessfulProposal
        isLive
    {
        Flan(domainConfig.flan).increaseMintAllowance(
            minter,
            enabled ? type(uint256).max : 0
        );
    }

    function _seed(
        address limbo,
        address flan,
        address eye,
        address sushiFactory,
        address uniFactory
    ) internal {
        domainConfig.limbo = limbo;
        domainConfig.flan = flan;
        require(
            Ownable(limbo).owner() == address(this) &&
                Ownable(flan).owner() == address(this),
            "LimboDAO: transfer ownership of limbo and flan."
        );
        domainConfig.eye = eye;
        domainConfig.live = true;
        domainConfig.uniFactory = uniFactory;
        domainConfig.sushiFactory = sushiFactory;
    }
}

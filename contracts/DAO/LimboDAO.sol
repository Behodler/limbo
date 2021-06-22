// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../ERC677/ERC677.sol";
import "../Flan.sol";
import "./ProposalFactory.sol";
import "../facades/SwapFactoryLike.sol";
import "../facades/UniPairLike.sol";
import "./Governable.sol";

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
                IERC20(token).transfer(from, uint256(amount * (-1))),
                "LimboDAO: ERC20 transfer failed."
            );
        }
    }
}

enum FateGrowthStrategy {straight, directRoot, indirectTwoRootEye}

enum ProposalDecision {voting, approved, rejected}

contract LimboDAO is Ownable {
    event daoKilled(address newOwner);
    event proposalLodged(address proposal, address proposer);
    event voteCast(address voter, address proposal, int256 fateCast);
    event assetApproval(address asset, bool appoved);
    event proposalExecuted(address proposal);
    event assetBurnt(address burner, address asset, uint256 fateCreated);

    using TransferHelper for address;
    using SafeMath for uint256;
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
        ProposalDecision decision;
        address proposer;
        uint256 start;
    }

    //rateCrate
    struct FateState {
        uint256 fatePerDay;
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
    mapping(address => bool) public assetApproved;
    mapping(address => FateState) public fateState; //lateDate
    mapping(address => mapping(address => AssetClout))
        public stakedUserAssetWeight; //user->asset->weight
    Proposal public currentProposal;
    ProposalState public currentProposalState;

    modifier isLive {
        require(domainConfig.live, "LimboDAO: DAO is not live. Wen Limbo?");
        _;
    }

    modifier onlySuccessfulProposal {
        require(successfulProposal(msg.sender), "LimboDAO: approve proposal");
        _;
        currentProposalState.decision = ProposalDecision.voting;
        currentProposal = Proposal(address(0));
    }

    function successfulProposal(address proposal) public view returns (bool) {
        return
            currentProposalState.decision == ProposalDecision.approved &&
            proposal == address(currentProposal);
    }

    modifier updateCurrentProposal {
        incrementFateFor(_msgSender());
        if (address(currentProposal) != address(0)) {
            uint256 durationSinceStart =
                block.timestamp.sub(currentProposalState.start);
            if (
                durationSinceStart >= proposalConfig.votingDuration &&
                currentProposalState.decision == ProposalDecision.voting
            ) {
                if (currentProposalState.fate > 0) {
                    currentProposalState.decision = ProposalDecision.approved;
                    (bool success, ) =
                        address(currentProposal).call(
                            abi.encodeWithSignature("orchestrateExecute()")
                        );
                    if (success)
                        fateState[currentProposalState.proposer]
                            .fateBalance += proposalConfig.requiredFateStake;
                } else {
                    currentProposalState.decision = ProposalDecision.rejected;
                }
            }
        }
        _;
    }

    modifier incrementFate {
        incrementFateFor(_msgSender());
        _;
    }

    function incrementFateFor(address user) public {
        FateState storage state = fateState[user];
        state.fateBalance +=
            (state.fatePerDay * (block.timestamp - state.lastDamnAdjustment)) /
            (1 days);
        state.lastDamnAdjustment = block.timestamp;
    }

    function seed(
        address limbo,
        address flan,
        address eye,
        address proposalFactory,
        address sushiFactory,
        address uniFactory,
        address[] memory sushiLPs,
        address[] memory uniLPs
    ) public onlyOwner {
        _seed(limbo, flan, eye, sushiFactory, uniFactory);
        proposalConfig.votingDuration = 2 days;
        proposalConfig.requiredFateStake = 223 * ONE; //50000 EYE for 24 hours
        proposalConfig.proposalFactory = proposalFactory;
        for (uint256 i = 0; i < sushiLPs.length; i++) {
            require(
                UniPairLike(sushiLPs[i]).factory() == sushiFactory,
                "LimboDAO: invalid Sushi LP"
            );
            if (IERC20(eye).balanceOf(sushiLPs[i]) > 1000)
                assetApproved[sushiLPs[i]] = true;
            fateGrowthStrategy[sushiLPs[i]] = FateGrowthStrategy
                .indirectTwoRootEye;
        }
        for (uint256 i = 0; i < uniLPs.length; i++) {
            require(
                UniPairLike(uniLPs[i]).factory() == uniFactory,
                "LimboDAO: invalid Sushi LP"
            );
            if (IERC20(eye).balanceOf(uniLPs[i]) > 1000)
                assetApproved[uniLPs[i]] = true;
            fateGrowthStrategy[uniLPs[i]] = FateGrowthStrategy
                .indirectTwoRootEye;
        }
    }

    function killDAO(address newOwner) public onlyOwner isLive {
        domainConfig.live = false;
        Governable(domainConfig.flan).setDAO(newOwner);
        Governable(domainConfig.limbo).setDAO(newOwner);
        emit daoKilled(newOwner);
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
        require(
            address(currentProposal) == address(0) ||
                currentProposalState.decision != ProposalDecision.voting,
            "LimboDAO: active proposal."
        );
        fateState[proposer].fateBalance = fateState[proposer].fateBalance.sub(
            proposalConfig.requiredFateStake * 2
        );
        currentProposal = Proposal(proposal);
        currentProposalState.decision = ProposalDecision.voting;
        currentProposalState.fate = 0;
        currentProposalState.proposer = proposer;
        currentProposalState.start = block.timestamp;
        emit proposalLodged(proposal, proposer);
    }

    function vote(address proposal, int256 fate)
        public
        // updateCurrentProposal
        incrementFate
        isLive
    {
        require(
            proposal == address(currentProposal), //this is just to protect users with out of sync UIs
            "LimboDAO: stated proposal does not match current proposal"
        );
        require(
            currentProposalState.decision == ProposalDecision.voting,
            "LimboDAO: voting on proposal closed"
        );
        if (
            block.timestamp - currentProposalState.start >
            proposalConfig.votingDuration - 1 hours
        ) {
            int256 currentFate = currentProposalState.fate;
            //The following if statement checks if the vote is flipped by fate
            if (
                fate * currentFate < 0 && //sign different
                (fate + currentFate) * fate > 0 //fate flipped current fate onto the same side of zero as fate
            ) {
                currentProposalState.start =
                    currentProposalState.start +
                    2 hours;
            } else if (
                block.timestamp - currentProposalState.start >
                proposalConfig.votingDuration
            ) {
                revert("LimboDAO: voting for current proposal has ended.");
            }
        }
        uint256 cost = fate > 0 ? uint256(fate) : uint256(-fate);
        fateState[_msgSender()].fateBalance = fateState[_msgSender()]
            .fateBalance
            .sub(cost);

        currentProposalState.fate += fate;
        emit voteCast(_msgSender(), proposal, fate);
    }

    function executeCurrentProposal() public updateCurrentProposal {
        emit proposalExecuted(address(currentProposal));
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

    function setApprovedAsset(address asset, bool approved)
        public
        onlySuccessfulProposal
    {
        assetApproved[asset] = approved;
        fateGrowthStrategy[asset] = FateGrowthStrategy.indirectTwoRootEye;
        emit assetApproval(asset, approved);
    }

    function stakeEYEBasedAsset(
        uint256 finalAssetBalance,
        uint256 finalEYEBalance,
        uint256 rootEYE,
        address asset
    ) public isLive incrementFate {
        require(assetApproved[asset], "LimboDAO: illegal asset");
        address sender = _msgSender();
        FateGrowthStrategy strategy = fateGrowthStrategy[asset];
        uint256 rootEYESquared = rootEYE * rootEYE;
        uint256 rootEYEPlusOneSquared = (rootEYE + 1) * (rootEYE + 1);
        require(
            rootEYESquared <= finalEYEBalance &&
                rootEYEPlusOneSquared > finalEYEBalance,
            "LimboDAO: Stake EYE invariant."
        );
        AssetClout storage clout = stakedUserAssetWeight[sender][asset];
        fateState[sender].fatePerDay -= clout.fateWeight;
        uint256 initialBalance = clout.balance;
        //EYE
        if (strategy == FateGrowthStrategy.directRoot) {
            require(
                finalAssetBalance == finalEYEBalance,
                "LimboDAO: staking eye invariant."
            );
            require(asset == domainConfig.eye);

            clout.fateWeight = rootEYE;
            clout.balance = finalAssetBalance;
            fateState[sender].fatePerDay += rootEYE;
        } else if (strategy == FateGrowthStrategy.indirectTwoRootEye) {
            //LP
            clout.fateWeight = 2 * rootEYE;
            fateState[sender].fatePerDay += clout.fateWeight;

            uint256 actualEyeBalance =
                IERC20(domainConfig.eye).balanceOf(asset);
            require(actualEyeBalance > 0, "LimboDAO: No EYE");
            uint256 totalSupply = IERC20(asset).totalSupply();
            uint256 eyePerUnit = (actualEyeBalance * ONE) / totalSupply;
            uint256 impliedEye = (eyePerUnit * finalAssetBalance) / ONE;
            require(
                finalEYEBalance == impliedEye,
                "LimboDAO: stake invariant check 2."
            );
            clout.balance = finalAssetBalance;
        } else {
            revert("LimboDAO: asset growth strategy not accounted for");
        }
        int256 netBalance = int256(finalAssetBalance) - int256(initialBalance);
        asset.ERC20NetTransfer(sender, address(this), netBalance);
    }

    function burnAsset(address asset, uint256 amount)
        public
        isLive
        incrementFate
    {
        require(assetApproved[asset], "LimboDAO: illegal asset");
        address sender = _msgSender();
        require(
            ERC677(asset).transferFrom(sender, address(this), amount),
            "LimboDAO: transferFailed"
        );
        uint256 fateCreated = fateState[_msgSender()].fateBalance;
        if (asset == domainConfig.eye) {
            fateCreated = amount * 10;
            ERC677(domainConfig.eye).burn(amount);
        } else {
            uint256 actualEyeBalance =
                IERC20(domainConfig.eye).balanceOf(asset);
            require(actualEyeBalance > 0, "LimboDAO: No EYE");
            uint256 totalSupply = IERC20(asset).totalSupply();
            uint256 eyePerUnit = (actualEyeBalance * ONE) / totalSupply;
            uint256 impliedEye = (eyePerUnit * amount) / ONE;
            fateCreated = impliedEye * 20;
        }
        fateState[_msgSender()].fateBalance += fateCreated;
        emit assetBurnt(_msgSender(), asset, fateCreated);
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

    function makeLive() public onlyOwner {
        require(
            Governable(domainConfig.limbo).DAO() == address(this) &&
                Governable(domainConfig.flan).DAO() == address(this),
            "LimboDAO: transfer ownership of limbo and flan."
        );
        domainConfig.live = true;
    }

    //if the DAO is being dismantled.
    function transferOwnershipOfThing(address thing, address destination)
        public
        onlySuccessfulProposal
    {
        Ownable(thing).transferOwnership(destination);
    }

    function timeRemainingOnProposal() public view returns (uint256) {
        require(
            currentProposalState.decision == ProposalDecision.voting,
            "LimboDAO: proposal finished."
        );
        uint256 elapsed = block.timestamp.sub(currentProposalState.start);
        if (elapsed > proposalConfig.votingDuration) return 0;
        return proposalConfig.votingDuration - elapsed;
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
        domainConfig.eye = eye;
        domainConfig.uniFactory = uniFactory;
        domainConfig.sushiFactory = sushiFactory;
        assetApproved[eye] = true;
        fateGrowthStrategy[eye] = FateGrowthStrategy.directRoot;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "./facades/AngbandLike.sol";
import "./facades/FlanLike.sol";
import "./facades/BehodlerLike.sol";
import "./periphery/UniswapV2/interfaces/IUniswapV2Factory.sol";
import "./openzeppelin/Ownable.sol";
// import "./facades/AddTokenToBehodlerPowerLike.sol";

///@author Justin Goro
/**@notice beyond scope of current audit. We can try different strategies on testnet before we've settled with something we like before auditing.
* No point in auditing now, only to throw it out on day 1.
*/
///@dev this contract combines multiple genesis operations into one transaction to protect against entereing into an invalid state
contract FlanGenesis is Ownable{
    struct Dependencies {
        BehodlerLike behodler;
        IUniswapV2Factory uniswapFactory;
        IUniswapV2Factory sushiswapFactory;
    }    

    Dependencies public dependencies;

    function LetThereBeFlan(uint daiAVB, uint daiPerSCX) public onlyOwner{
        //assert that the daiABV is the sams as on Behodler right now.
        //assert that withdrawFindLiquidiy yields dai per SCX.

        //call power to create and register flan awith lachesis and behodler. Parameterize power with daiAVB and scxPerDai. 
        //We want to mint Flan quantity of daiAVB + scxMinted*DaiPerSCX + 500 and send 500 to pyroPower. 
        //Send rest to this contract.Also send SCX to this contract.
        //call pyro power to create pyro and mint 500 Pyro (to protect against redeem rate jigging).
        //divide flan into 2 parts and mint PyroFlan. Divide remainin flan into 2 parts and pyro into 2 parts. Call these portions F0,F1, P0 and P1
        //Unifactory.create pairs for Flan/SCX and PyroFlan/SCX. Same for Sushi factory.
        //Let S4 = Scarcity balance divided by 4. Create LP tokens for F0/S4 on Uni,F1/S4 on Sushi,P0/S4 on Uni ,P1/S4 on Sushi.
        //We assume the LP token balances are all of equal value. Dai value of an LP batch = F0x2. PriceOfLP = Dai_Value/balanceOFLP
        // SeedQuantity = DaiAVB/PriceOfLP
        //call power to register all 4 LPs with lachesis and seed Behodler with SeedQuantity. Return SCX generated to this contract.
        //Flan to generate = (SCX_generated*daiPerSCX). Mint Flan_to_generate.  
        //Let newly minted Flan by FN. Divide FN and newly generated SCX into 4. Restock each LP with FN and SCX
        //Don't do anything with any remaining SCX, FLAN, PyroFlan or LP tokens. They are all considered burnt and liquidity is locked. 
        //Until Limbo launches, the only way to get Flan will be to buy it from Uniswap, Sushiswap or behodler.

        //Remember to end configuration of Limbo
        //Also remember to get the cyclical dependencies correct. Whether to create Flan and Limbo first before running this Or to use this to create all of them.
    }
}
type address = string;
export interface OutputAddress {
    [key:string]: address;
  }

export interface AddressFileStructure{
    [key:string]:OutputAddress
}

/*
deployBehodler
deployTokens
deployLiquidityReceiver
deployWeth
deployUniswap
deployLimboDAO
deployFlan
deployLimbo
deployProposalFactory
deployMorgothDAO
deploySoulReader
deployMultiCall
*/
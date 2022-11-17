import { deploy, executionResult, numberClose, queryChain } from "../helpers";

const { expect, assert } = require("chai");
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as Types from "../../typechain";
import { BigNumber, ContractFactory } from "ethers";
const web3 = require("web3");

interface TestSet {
  owner: SignerWithAddress,
  secondary: SignerWithAddress
  tertiary: SignerWithAddress
  angband: Types.Angband
  powers: Types.PowersRegistry
  morgothTokenApprover: Types.MorgothTokenApprover
  configureTokenApproverPower: Types.ConfigureTokenApproverPower
  powerName: string
  domainName: string
  TA_Minion: string
  goodTokens: Types.MockToken[]
  badTokens: Types.MockToken[]
  tokenProxyRegistry: Types.TokenProxyRegistry
}

const stringToBytes = (s: string): string => {
  let padded = s.padEnd(32, "\0")
  return ethers.utils.hexlify(ethers.utils.arrayify(web3.utils.fromAscii(padded)))
}

describe("Morgoth Token Approver Integration test", function () {
  let SET = {} as TestSet;
  SET.powerName = stringToBytes("CONFIGURE_TOKEN_APPROVER")
  console.log('CONFIGURE_TOKEN_APPROVER: ' + SET.powerName)
  SET.domainName = stringToBytes("TOKEN_APPROVER")
  SET.TA_Minion = stringToBytes("TA_Minion")
  this.beforeEach(async function () {
    [SET.owner, SET.secondary, SET.tertiary] = await ethers.getSigners();
    /*
1. Powers
2. Powers.seed()
3. Angband
4. Angband.finalizeSetup()
5. Create power CONFIGURE_TOKEN_APPROVER
6. Assign power to melkor
8. Create tokenApprover
7. map tokenApprover domain to power

9. Transfer ownership to morgoth and map to domain
10. Deploy ConfigureTokenApproverPower
*/

    const mockTokenFactory = await ethers.getContractFactory("MockToken")
    SET.goodTokens = []
    for (let i = 0; i < 10; i++) {
      SET.goodTokens.push(
        await deploy<Types.MockToken>(mockTokenFactory, "Good-" + i, "GT-" + i, [], [])
      )
    }
    SET.badTokens = [SET.goodTokens[2], SET.goodTokens[4], SET.goodTokens[5]]


    const powersFactory = await ethers.getContractFactory("PowersRegistry")
    SET.powers = await deploy<Types.PowersRegistry>(powersFactory)
    await SET.powers.seed()

    const angbandFactory = await ethers.getContractFactory("Angband")
    SET.angband = await deploy<Types.Angband>(angbandFactory, SET.powers.address)
    await SET.angband.finalizeSetup()

    await SET.powers.create(SET.powerName, SET.domainName, true, false)
    await SET.powers.pour(SET.powerName, SET.TA_Minion)

    await SET.powers.bondUserToMinion(SET.secondary.address, SET.TA_Minion)

    const AddressToStringFactory = await ethers.getContractFactory("AddressToString")
    const addressToString = await deploy<Types.AddressToString>(AddressToStringFactory)

    const proxyDeployerFactory = await ethers.getContractFactory("ProxyDeployer")
    const proxyDeployer = await deploy<any>(proxyDeployerFactory)

    const mockDAO = SET.powers.address //we won't be using this address
    const mockBehodler = SET.owner.address //we won't be using this address
    const mockReferenceToken = SET.goodTokens[4].address

    const mockLimbo = SET.goodTokens[3].address
    const mockFlan = SET.secondary.address

    const TokenProxyRegistry = await ethers.getContractFactory("TokenProxyRegistry")
    SET.tokenProxyRegistry = await deploy<Types.TokenProxyRegistry>(TokenProxyRegistry, mockDAO, mockBehodler)

    const tokenApproverFactory = await ethers.getContractFactory("MorgothTokenApprover", {
      libraries: { ProxyDeployer: proxyDeployer.address, AddressToString: addressToString.address },
    })

    SET.morgothTokenApprover = await deploy<Types.MorgothTokenApprover>(tokenApproverFactory)
    await SET.morgothTokenApprover.updateConfig(SET.tokenProxyRegistry.address, mockReferenceToken, mockBehodler, mockLimbo, mockFlan)

    await SET.morgothTokenApprover.transferOwnership(SET.angband.address)
    await SET.angband.mapDomain(SET.morgothTokenApprover.address, SET.domainName)

    const configureTokenApproverFactory = await ethers.getContractFactory("ConfigureTokenApproverPower")
    SET.configureTokenApproverPower = await deploy<Types.ConfigureTokenApproverPower>(configureTokenApproverFactory, SET.angband.address, SET.powers.address)
    await SET.angband.authorizeInvoker(SET.configureTokenApproverPower.address, true)
  })

  it("t0. Test Real Deployment setup.", async function () {

  })

  it("t1. ConfigureTokenApprover approves list of tokens correctly, unapproves list correctly", async function () {
    await expect(SET.configureTokenApproverPower.setApprove(SET.goodTokens.map(t => t.address), SET.goodTokens.map(t => true)))
      .to
      .be
      .revertedWith("MORGOTH: forbidden power")


    const choiceBefore = await SET.configureTokenApproverPower.getChoice()
    expect(choiceBefore.toString()).to.equal("0")
    //successful call updates correctly.

    await SET.configureTokenApproverPower.connect(SET.secondary).setApprove(SET.goodTokens.map(t => t.address), SET.goodTokens.map(t => true))

    for (let i = 0; i < SET.goodTokens.length; i++) {
      const approved = await SET.morgothTokenApprover.morgothApproved(SET.goodTokens[i].address)
      expect(approved).to.be.false
    }

    let choiceAfterFirst = await SET.configureTokenApproverPower.getChoice()
    expect(choiceAfterFirst.toString()).to.equal("1")
    await SET.angband.connect(SET.secondary).executePower(SET.configureTokenApproverPower.address)

    for (let i = 0; i < SET.goodTokens.length; i++) {
      const approved = await SET.morgothTokenApprover.morgothApproved(SET.goodTokens[i].address)
      expect(approved).to.be.true
    }

    const choiceAfterExecution = await SET.configureTokenApproverPower.getChoice()
    expect(choiceAfterExecution.toString()).to.equal("0")

    await SET.configureTokenApproverPower.connect(SET.secondary).setApprove(SET.badTokens.map(t => t.address), SET.goodTokens.map(t => false))
    await SET.angband.connect(SET.secondary).executePower(SET.configureTokenApproverPower.address)


    for (let i = 0; i < SET.goodTokens.length; i++) {
      const isApproved = !(i === 2 || i === 4 || i === 5)
      const approved = await SET.morgothTokenApprover.morgothApproved(SET.goodTokens[i].address)
      expect(approved).to.equal(isApproved)
    }
  })

  it("t2. ConfigureTokenApprover updatesConfig", async function () {
    //attempt to call from secondary fails
    await expect(SET.configureTokenApproverPower.setUpdateConfig(SET.owner.address, SET.owner.address, SET.owner.address, SET.owner.address, SET.owner.address))
      .to.be.revertedWith("MORGOTH: forbidden power")

    const choiceBefore = await SET.configureTokenApproverPower.getChoice()
    expect(choiceBefore.toString()).to.equal("0")
    //successful call updates correctly.
    await SET.configureTokenApproverPower.connect(SET.secondary).setUpdateConfig(SET.angband.address, SET.powers.address, SET.secondary.address, SET.morgothTokenApprover.address, SET.owner.address)
    await SET.angband.connect(SET.secondary).executePower(SET.configureTokenApproverPower.address)

    const choiceAfter = await SET.configureTokenApproverPower.getChoice()
    expect(choiceAfter.toString()).to.equal("0")

    const configAfter = await SET.morgothTokenApprover.config()
    expect(configAfter.proxyRegistry).to.equal(SET.angband.address)
    expect(configAfter.referenceToken).to.equal(SET.powers.address)
    expect(configAfter.behodler).to.equal(SET.secondary.address)
    expect(configAfter.limbo).to.equal(SET.morgothTokenApprover.address)
    expect(configAfter.flan).to.equal(SET.owner.address)
  })

  it("t3. MorgothTokenApprover creates CliffFace and LimboProxy and ConfigureTokenApprover unmaps them", async function () {
    //morgoth proposal to block some tokens
    const blockIndexes = [3, 4, 7]
    const tokensToBlock = [SET.goodTokens[3], SET.goodTokens[4], SET.goodTokens[7]]
      .map(t => t.address)

    await SET.configureTokenApproverPower.connect(SET.secondary).setBlockBaseToken(tokensToBlock, tokensToBlock.map(t => true))
    await SET.angband.connect(SET.secondary).executePower(SET.configureTokenApproverPower.address)

    //Create cliff face directly without morgoth
    await SET.morgothTokenApprover.generateCliffFaceProxy(SET.goodTokens[0].address, ethers.constants.WeiPerEther, false)
    await SET.morgothTokenApprover.generateCliffFaceProxy(SET.goodTokens[1].address, ethers.constants.WeiPerEther, true)

    //wrap the same base token twice fails.
    await expect(SET.morgothTokenApprover.generateCliffFaceProxy(SET.goodTokens[1].address, ethers.constants.WeiPerEther, true))
      .to
      .be
      .revertedWith(`TokenAlreadyRegistered("${SET.goodTokens[1].address}")`)

    await expect(SET.morgothTokenApprover.generateCliffFaceProxy(SET.goodTokens[0].address, ethers.constants.WeiPerEther, true))
      .to
      .be
      .revertedWith(`TokenAlreadyRegistered("${SET.goodTokens[0].address}")`)

    //generate on blocked tokens fails
    tokensToBlock.forEach(async t => {
      await expect(SET.morgothTokenApprover.generateCliffFaceProxy(t, ethers.constants.WeiPerEther, true))
        .to.be.revertedWith(`CliffFaceGenerationBlocked("${t}")`)
    })
    //verify that limbo proxy has them registered.

    let proxyConfigForToken0 = await SET.tokenProxyRegistry.tokenProxy(SET.goodTokens[0].address)
    let proxyConfigForToken1 = await SET.tokenProxyRegistry.tokenProxy(SET.goodTokens[1].address)

    //behdoler proxies are non zero
    expect(proxyConfigForToken0.behodlerProxy)
      .to.not.equal(ethers.constants.AddressZero)
    expect(proxyConfigForToken1.behodlerProxy).to.not.equal(ethers.constants.AddressZero)

    //Limbo is token0 for token0 and not token0 for token1
    expect(proxyConfigForToken0.limboProxy).to.equal(SET.goodTokens[0].address)
    expect(proxyConfigForToken1.limboProxy).to.not.equal(SET.goodTokens[1].address)

    let approverCliffFaceMapping0 = await SET.morgothTokenApprover.cliffFaceMapping(SET.goodTokens[0].address)
    let approverCliffFaceMapping1 = await SET.morgothTokenApprover.cliffFaceMapping(SET.goodTokens[1].address)
    
    expect(approverCliffFaceMapping0).to.equal(proxyConfigForToken0.behodlerProxy)
    expect(approverCliffFaceMapping1).to.equal(proxyConfigForToken1.behodlerProxy)
    
    //Unmap token1

    await SET.configureTokenApproverPower.connect(SET.secondary).setUnmapParams([SET.goodTokens[0].address,SET.goodTokens[1].address])
    await SET.angband.connect(SET.secondary).executePower(SET.configureTokenApproverPower.address)

     proxyConfigForToken0 = await SET.tokenProxyRegistry.tokenProxy(SET.goodTokens[0].address)
     proxyConfigForToken1 = await SET.tokenProxyRegistry.tokenProxy(SET.goodTokens[1].address)

    //behdoler proxies are zero
    expect(proxyConfigForToken0.behodlerProxy)
      .to.equal(ethers.constants.AddressZero)
    expect(proxyConfigForToken1.behodlerProxy).to.equal(ethers.constants.AddressZero)

    //Limbo unchanged: token0 for token0 and not token0 for token1
    expect(proxyConfigForToken0.limboProxy).to.equal(SET.goodTokens[0].address)
    expect(proxyConfigForToken1.limboProxy).to.not.equal(SET.goodTokens[1].address)
  
  
     approverCliffFaceMapping0 = await SET.morgothTokenApprover.cliffFaceMapping(SET.goodTokens[0].address)
     approverCliffFaceMapping1 = await SET.morgothTokenApprover.cliffFaceMapping(SET.goodTokens[1].address)
    
    expect(approverCliffFaceMapping0).to.equal(proxyConfigForToken0.behodlerProxy)
    expect(approverCliffFaceMapping1).to.equal(proxyConfigForToken1.behodlerProxy)
    
  })

})
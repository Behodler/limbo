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
  powerName: Uint8Array
  domainName: Uint8Array
  TA_Minion: Uint8Array
}

const stringToBytes = (s: string): Uint8Array => {
  let padded = s.padStart(32, "0")
  return ethers.utils.arrayify(web3.utils.fromAscii(padded))
}

describe("Morgoth Token Approver Integration test", function () {
  let SET = {} as TestSet;
  SET.powerName = stringToBytes("CONFIGURE_TOKEN_APPROVER")
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

    const tokenApproverFactory = await ethers.getContractFactory("MorgothTokenApprover", {
      libraries: { ProxyDeployer: proxyDeployer.address, AddressToString: addressToString.address },
    })

    SET.morgothTokenApprover = await deploy<Types.MorgothTokenApprover>(tokenApproverFactory)

    await SET.morgothTokenApprover.transferOwnership(SET.angband.address)
    await SET.angband.mapDomain(SET.morgothTokenApprover.address, SET.domainName)

    const configureTokenApproverFactory = await ethers.getContractFactory("ConfigureTokenApproverPower")
    SET.configureTokenApproverPower = await deploy<Types.ConfigureTokenApproverPower>(configureTokenApproverFactory, SET.angband.address, SET.powers.address)
    await SET.angband.authorizeInvoker(SET.configureTokenApproverPower.address, true)
  })

  it("t0. Test Real Deployment setup.", async function () {

  })

  it("t1. ConfigureTokenApprover approves list of tokens correctly, unapproves list correctly", async function () {
    throw "not implemented"
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
    throw "not implemented"
  })

})
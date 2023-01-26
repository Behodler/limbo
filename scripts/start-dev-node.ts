import hre from "hardhat"
import {ethers} from "ethers"
import {safeDeploy} from "./networks/orchestrate"
import { takeSnapshot } from "@nomicfoundation/hardhat-network-helpers"
import behodlerABI from "../ABIs/Behodler.json"
import UniswapV2Pair from "../ABIs/UniswapV2Pair.json"

async function deploy() {
    const { chainId } = await hre.ethers.provider.getNetwork();
    const deployment = await safeDeploy(chainId, 2, 9);

    return {
        provider: hre.ethers.provider,
        deployment,
    }
}
async function main() {
    const node = hre.run('node', { noDeploy: true });
    const { deployment, provider } = await deploy()
    const snap = await takeSnapshot()

    console.info('snap', snap);

    const wallet = new ethers.Wallet('cf4a9e84114acde4e307c37c27f91ea161516b83e70a8fe2096a97100beaedd9', provider);

    const ownerETHBalance = ethers.utils.formatEther(await provider.getBalance(wallet.address));

    const Behodler = new ethers.Contract(
        deployment.Behodler, behodlerABI, wallet
    )

    const EyeDai = new ethers.Contract(
        deployment.EYE_DAI, UniswapV2Pair, wallet
    )

    console.info('ownerETHBalance', ownerETHBalance)
    console.info('Weth addy', await Behodler.Weth())
    console.info('eyeDai supply', await EyeDai.totalSupply())

    await node;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

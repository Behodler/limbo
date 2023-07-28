import { safeDeploy } from './networks/orchestrate'
import shell from "shelljs"
import hre from "hardhat"

async function main() {

    const logger = (message: string) => console.log(message)
    try {
        const [deployer] = await hre.ethers.getSigners()
        logger("deployer: " + deployer.address)
        const balanceBefore = await deployer.getBalance()
        const deployment = await safeDeploy('onlyPyroV3', 1, 6, logger)
        logger("ADDRESSES:")
        logger(JSON.stringify(deployment, null, 4))
        const balanceAfter = await deployer.getBalance()
        const ethConsumed = balanceBefore.sub(balanceAfter)
        logger('Eth consumed ' + ethConsumed)

    }
    catch (error) {
        console.log(error)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
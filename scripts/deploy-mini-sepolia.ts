import { safeDeploy } from './networks/orchestrate'
import hre from "hardhat"
async function main() {

    const logger = (message: string) => console.log(message)
    try {
        const [deployer] = await hre.ethers.getSigners()
        logger("deployer: " + deployer.address)
        const balanceBefore = BigInt((await deployer.getBalance()).toString())
        const deployment = await safeDeploy('mini-sepolia', 11155111, 5, logger)
        const balanceAfter = BigInt((await deployer.getBalance()).toString())

        logger('total eth consumed on mini sepolia run' + (balanceBefore - balanceAfter))
        logger("ADDRESSES:")

        logger(JSON.stringify(deployment, null, 4))
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
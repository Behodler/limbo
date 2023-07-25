import { safeDeploy } from './networks/orchestrate'
async function main() {

    const logger = (message: string) => console.log(message)
    try {
        const deployment = await safeDeploy('statusquo', 11155111, 4, logger)
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
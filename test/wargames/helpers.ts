import { EthereumProvider } from "hardhat/types/provider"

export const runSynchronously = async (provider: EthereumProvider, code: () => any): Promise<any> => {
    try {
        await provider.send("evm_setAutomine", [false]);
        const output = await code()
        if (output)
            return output
    } finally {
        await provider.send("evm_setAutomine", [true]);
    }
}
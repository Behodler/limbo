import fs from "fs"

const textBlob = fs.readFileSync("./RESULTS.txt", "utf-8")
    .split("\n")

console.log(textBlob.length)

const patterns = [/Mined empty block range #[0-9]* to #[0-9]*/,
    /eth_getBlockByNumber/,
    /evm_setNextBlockTimestamp/,
    /hardhat_mine/,
    /Mined empty block #[0-9]* with base fee [0-9]*/,
    /eth_blockNumber/,
    /eth_getTransactionCount/,
    /eth_getTransactionByHash/,
    /eth_chainId/,
    /eth_getTransactionReceipt/,
    /eth_call/
]


const cleanLines: string[] = []
textBlob.forEach((line: string) => {
    let found = false
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i]
        const regex = new RegExp(pattern)
        if (regex.test(line.trim())) {
            found = true
        }
    }
    if (!found && line.trim().length>1)
        cleanLines.push(line)

})

const output = cleanLines.join("\n")
fs.writeFileSync("RESULTS_clean.txt", output)

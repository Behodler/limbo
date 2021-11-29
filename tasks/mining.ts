import { task } from "hardhat/config";

task("advance", "Advance some blocks")
  .addOptionalParam("blocks", "Number of blocks to advance")
  .addOptionalParam("seconds", "Number of seconds to advance")
  .setAction(async ({ blocks, seconds }, { network }) => {
    if (!blocks && !seconds) throw Error("Invalid parameters");

    if (blocks) {
      for (let i = 0; i < blocks; i++) {
        await network.provider.send("evm_mine");
      }
    }

    if (seconds) {
      await network.provider.send("evm_increaseTime", [Number(seconds)]);
      await network.provider.send("evm_mine");
    }
  });

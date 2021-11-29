import { BigNumber } from "ethers";
import { formatEther } from "ethers/lib/utils";

export const formatBigNumberObj = (obj: object) => {
  const o = Object.keys(obj).reduce((prev, cur) => {
    const value = (obj as any)[cur];

    if (value instanceof BigNumber) {
      (prev as any)[cur] = value.toString();
    } else {
      (prev as any)[cur] = value;
    }

    return prev;
  }, {});
};

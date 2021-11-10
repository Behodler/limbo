import { readFileSync } from "fs";

export const getAddresses = (): { [key: string]: string } => {
  try {
    return JSON.parse(readFileSync("../addresses.json", "utf-8"));
  } catch (e) {
    console.log(e);
    return {};
  }
};

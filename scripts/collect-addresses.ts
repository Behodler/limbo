import { readFileSync, writeFileSync } from "fs";

const main = () => {
  const rawData = readFileSync("deployed.json");
  const data = JSON.parse(String(rawData));
  const contracts = data.contracts;
  const addresses = Object.keys(contracts).reduce((prev, cur) => {
    (prev as any)[cur] = contracts[cur].address;
    return prev;
  }, {});
  writeFileSync("addresses.json", JSON.stringify(addresses));
};

main();

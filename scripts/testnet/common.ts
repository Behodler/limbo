type address = string;
export interface OutputAddress {
  [key: string]: address;
}

export interface AddressFileStructure {
  [key: string]: OutputAddress;
}

export function logFactory(visible: boolean) {
  return function (message: any) {
    if (visible) console.log(message);
  };
}

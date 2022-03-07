type address = string;
export interface OutputAddress {
    [key:string]: address;
  }

export interface AddressFileStructure{
    [key:string]:OutputAddress
}

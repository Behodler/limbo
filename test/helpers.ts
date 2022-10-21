import { Result } from "@ethersproject/abi/lib/interface";
import { Contract, ContractFactory, Event } from "ethers";
export interface IExecutionResult {
  success: boolean; error: string
}
export interface IQueryResult { success: boolean; error: string; result: any }
export async function executionResult(transaction): Promise<IExecutionResult> {
  try {
    await transaction;
    return { success: true, error: "" };
  } catch (e: any) {
    return { success: false, error: e };
  }
}

export const queryChain = async (query): Promise<IQueryResult> => {
  let result;
  try {
    result = await query;
    return { success: true, error: "", result};
  } catch (e) {
    return { success: false, error: e as string, result: null };
  }
};

interface numberCloseResult{
  close:boolean
  message:string
}

export const numberClose = (actual, expected, range?:bigint):numberCloseResult => {
  range  = range || 20n
  let expectedBig = BigInt(expected.toString());
  const actualBig = BigInt(actual.toString());
  
  const lower = (expectedBig / (80n + range)) * 80n;
  const higher = (expectedBig * (100n+range)) / 100n;
  const condition = lower < actualBig && higher > actualBig;
  if (!condition) {
    const perc = parseFloat(`${(actualBig * 10000n) / expectedBig}`) / 10000;
  }

  return {close:condition,message :`expected close to ${expected}, actual: ${actual}`};
};

type eventAssertionReasons =
  | ""
  | "NO_LOGS_FOUND"
  | "NOT_FOUND"
  | "EXPECTED_ARGS_NOT_FOUND"
  | "ARG_NOT_FOUND"
  | "ARG_VALUE_MISMATCH";

interface EventAssertionResult {
  reason: eventAssertionReasons;
  details?: string;
}

export const assertLog = async (
  logs: Event[] | undefined,
  eventName: string,
  args?: Result[]
): Promise<EventAssertionResult> => {
  if (!logs) return { reason: "NO_LOGS_FOUND" };
  const matchingLog = logs.find((log) => log.event === eventName);
  if (!matchingLog) return { reason: "NOT_FOUND" };
  if (args) {
    if (!matchingLog.args) return { reason: "EXPECTED_ARGS_NOT_FOUND" };

    let argNames = Object.keys(args);

    for (let i = 0; i < argNames.length; i++) {
      let currentArgName = argNames[i];
      let currentArgValue = args[currentArgName];
      if (typeof currentArgValue === "string") currentArgValue = currentArgValue.toUpperCase();
      let keysOfMatchinArgs = Object.keys(matchingLog.args);
      let matchingArgName = keysOfMatchinArgs.find((name) => name === currentArgName);
      if (!matchingArgName) return { reason: "ARG_NOT_FOUND", details: "currentArgName " + currentArgName };
      let matchingArgValue = matchingLog.args[matchingArgName];

      matchingArgValue = matchingArgValue.toString().toUpperCase();

      if (matchingArgValue !== currentArgValue) {
        return {
          reason: "ARG_VALUE_MISMATCH",
          details: `expected ${currentArgValue} but got ${matchingArgValue}`,
        };
      }
    }
  }
  return { reason: "" };
};


export async function deploy<T extends Contract>(
  contractFactory: ContractFactory,
  ...args: Array<any>
): Promise<T> {
  return (await contractFactory.deploy(...args)) as T;
}

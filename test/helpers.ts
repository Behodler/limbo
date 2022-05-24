export async function executionResult(transaction): Promise<{ success: boolean; error: string }> {
  try {
    await transaction;
    return { success: true, error: "" };
  } catch (e: any) {
    return { success: false, error: e };
  }
}

export const queryChain = async (query): Promise<{ success: boolean; error: string; result: any }> => {
  let result;
  try {
    result = await query;
    return { success: true, error: "", result };
  } catch (e) {
    return { success: false, error: e as string, result: null };
  }
};


export const numberClose = (actual,expected) => {
    let expectedBig = BigInt(expected.toString())
    const actualBig = BigInt(actual.toString())
    const lower = expectedBig/100n*90n
    const higher = expectedBig *110n/100n
    return lower < actualBig && higher > actualBig
}
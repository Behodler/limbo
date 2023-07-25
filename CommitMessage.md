## Note on addresses
sepolia.json contains the latest addresses for testnet on this commit.

## Mainnet prep
Identifying the correct mainnet addresses and asserting that they are correctly configured is not only going to save on lost gas from failed deployments but will lay the groundwork for an iterative approach to releasing Limbo via testnets and then mainnet. 

## Change in deployment script
Now that Pyro UI has a faucet for testnets, the fake token seeding portion in the script is unnecessary.
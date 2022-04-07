# Limbo
Token Preseeding Smart Contracts for Behodler.

## Debuging
```
yarn && yarn build:debug
yarn node:dev
```
In a separate terminal, 
```
yarn scripts:addresses
yarn scripts:setup
```

Note that addresses generates will be in addresses.json. These must be copied across to LimboUI project into scr/constants/addresses/hardhat.json

If the ui and contracts repo are at the same level on your local file system then you the above copy step is automated by

```
yarn update:contracts
```

To update the UI in one step after starting a node run
```
yarn update:ui
```

# Testing
For standard unit tests, comment out the custom mining block in hardhat.config.js. 
Ropsten wargames are in memory unit tests of deployment scripts to Ropsten. They were written because long running scripts would fail against Ropsten with absolutely no debugging info provided. Makes sure the custom mining block is uncommented as the tests expect a block mining time. 
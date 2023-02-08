# Behodler Dev Env App

Nodejs server for creating a local dev environment for the Behodler front-end apps. Starts an HTTP server, runs a local hardhat node, and exposes API for creating and restoring network state snapshots.

## Hardhat config

The script is currently using the root `hardhat.config.ts` of this repo. Before using the app, make sure `minting` JSON field for the `hardhat` network is set as follows:
```
hardhat: {
  mining: {
    auto: false,
    interval: 2,
  }
}
```

## Development and usage

Currently, the app is not published as an npm package and it can only be used locally.
```
git clone git@github.com:Behodler/limbo.git
cd dev-env-app/server
yarn install
```
and then, when developing, run
```
yarn dev
```
When using the app as a dev environment for the Behodler front-end apps, run
```
yarn start
```

Both `yarn dev` and `yarn start` commands start the app using the default 6667 port for the HTTP server. To use a different port, use the `--port` or `-p` argument, e.g.
```
yarn dev --port 1234
yarn dev -p 1234
```
or 
```
yarn start --port 1234
yarn start -p 1234
```

When using `yarn dev`, the project files are watched for changes and the app is restarted automatically. `yarn start` does not watch for file changes and typescript type checking is disabled, therefore the startup is faster.

### Features

After initialization, the app does the following: 
1. Starts a local hardhat node:
   * URL: `http://localhost:8545` 
   * Chain ID: `1337`
2. Deploys Behodler ecosystem contracts using the `safeDeploy` function exported by `scripts/networks/orchestrate.ts` module.
3. Starts a local HTTP server and listens for requests on the specified port. 

### Available API endpoints

* `POST /create-snapshot` creates a snapshot of the current network state and returns the snapshot ID
* `POST /restore-snapshot` restores the network state using a snapshot identified by the snapshot ID specified in the request JSON body, e.g. `{ "snapshotId": "0x1" }`. Returns the restored snapshot ID and a list of snapshot IDs that were invalidated by restoring the snapshot. All snapshots that were created at a block exceeding the block of restored snapshot are invalidated.
* `GET /get-snapshots` returns a list of previously created snapshot IDs
* `GET /get-deployment-addresses` returns a name/address map of deployed contracts

### Usage examples using cURL
``` 
yarn start -p 1234

curl http://localhost:1234/create-snapshot -X POST
{
  "message":"snapshot 0x1 saved",
  "snapshotId":"0x1"
}

curl http://localhost:1234/create-snapshot -X POST
{
  "message":"snapshot 0x2 saved",
  "snapshotId":"0x2"
}

curl http://localhost:1234/get-snapshots
{
  "message":"saved snapshot ids fetched: 0x1, 0x2",
  "snapshotIds":["0x1","0x2"]
}

curl http://localhost:1234/restore-snapshot -X POST  -d '{ "snapshotId": "0x1" }' -H 'Content-Type: application/json'
{
  "message":"snapshot 0x1 restored",
  "snapshotId":"0x1",
  "invalidatedSnapshotIds":["0x2"]
}

curl http://localhost:1234/get-deployment-addresses
{
  "message":"deployment addresses fetched",
  "contracts": { "name": "address" }
}
```

### Usage examples using bin scripts
``` 
yarn start -p 1234

yarn create-snapshot -p 1234
{
  "message":"snapshot 0x1 saved",
  "snapshotId":"0x1"
}

yarn create-snapshot -p 1234
{
  "message":"snapshot 0x2 saved",
  "snapshotId":"0x2"
}

yarn get-snapshots -p 1234
{
  "message":"saved snapshot ids fetched: 0x1, 0x2",
  "snapshotIds":["0x1","0x2"]
}

yarn restore-snapshot -p 1234 --id '"0x1"'
It's important to wrap the snapshot ID in double quotes, otherwise the shell will interpret the ID as a number (e.g. 0x1 is interpreted as 1) and the request will fail.
{
  "message":"snapshot 0x1 restored",
  "snapshotId":"0x1",
  "invalidatedSnapshotIds":["0x2"]
}

yarn get-deployment-addresses -p 1234
{
  "message":"deployment addresses fetched",
  "contracts": { "name": "address" }
}
```

## Possible future improvements

1. Creating a simple UI utilizing the API endpoints
2. Publishing the app as a npm package and allowing to use custom deployment scripts - could be a neat open-source tool for other web3 projects
3. Allowing to use a custom hardhat config file, e.g. to use a different chain ID, a different hardhat node URL, etc.
4. Allowing to fork a mainnet node

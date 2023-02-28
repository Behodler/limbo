import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import fs from 'fs'
import path from 'path'
import { FastifyPluginCallback } from 'fastify'

import { BehodlerDevEnv, BehodlerDevEnvFastifyInstance } from './types'
import { safeDeploy } from '../../../scripts/networks/orchestrate'

// DEPLOYMENT SETTINGS
const DEPLOYED_ADDRESSES_JSON_FILE_PATH = path.resolve(
  __dirname,
  '../../../scripts/networks/addresses/hardhat.json',
)
const DEPLOYMENT_MINING_INTERVAL_MS = 10
const WORKING_MINING_INTERVAL_MS = 1000
const BLOCK_TIME_MS = 20000
const CONFIRMATIONS_NUMBER = 9
const AUTO_MINING_ENABLED = false
const DEPLOYMENT_RECIPE_NAME = 'testnet'

export function startDevEnvPlugin({
  setBehodlerDevEnv,
  setStartDevEnv,
}): FastifyPluginCallback {
  const initialBehodlerDevEnv: BehodlerDevEnv = {
    active: false,
    snapshots: [],
  }

  return function (fastify: BehodlerDevEnvFastifyInstance, opts, done): void {
    async function startHardhatNodeAndDeployBehodlerContracts(): Promise<BehodlerDevEnv> {
      const node: Promise<any> = hre.run('node', { noDeploy: true })
      fastify.log.info('started hardhat node')
      const { chainId } = await hre.ethers.provider.getNetwork()

      fastify.log.info(`setting auto mining to ${AUTO_MINING_ENABLED}`)
      await hre.network.provider.send("evm_setAutomine", [AUTO_MINING_ENABLED]);
      fastify.log.info(`auto mining ${AUTO_MINING_ENABLED ? 'enabled' : 'disabled'}`)

      if (!AUTO_MINING_ENABLED) {
        fastify.log.info(`setting mining interval to ${DEPLOYMENT_MINING_INTERVAL_MS / 1000} seconds`)
        await hre.network.provider.send("evm_setIntervalMining", [DEPLOYMENT_MINING_INTERVAL_MS]);
        fastify.log.info(`mining interval set to ${DEPLOYMENT_MINING_INTERVAL_MS / 1000} seconds`)
      }

      fastify.log.info('deploying Behodler contracts')
      const deployedAddresses = await safeDeploy(
        DEPLOYMENT_RECIPE_NAME,
        chainId,
        BLOCK_TIME_MS / 1000,
        CONFIRMATIONS_NUMBER,
        message => fastify.log.info(`deployment: ${message}`),
        )
      fastify.log.info('deployment complete')

      if (!AUTO_MINING_ENABLED) {
        fastify.log.info(`setting mining interval to ${WORKING_MINING_INTERVAL_MS / 1000} seconds`)
        await hre.network.provider.send("evm_setIntervalMining", [WORKING_MINING_INTERVAL_MS]);
        fastify.log.info(`mining interval set to ${WORKING_MINING_INTERVAL_MS / 1000} seconds`)
      }

      return { ...initialBehodlerDevEnv, active: true, node, deployedAddresses }
    }

    async function startDevEnv() {
      try {
        fastify.log.info('starting dev env')

        if (fastify?.behodlerDevEnv?.active) {
          return fastify.log.info('dev env already running')
        }

        if (fs.existsSync(DEPLOYED_ADDRESSES_JSON_FILE_PATH)) {
          fastify.log.info(`removing ${DEPLOYED_ADDRESSES_JSON_FILE_PATH}`)
          fs.rmSync(DEPLOYED_ADDRESSES_JSON_FILE_PATH)
          fastify.log.info('file removed, starting dev env')
        }

        setBehodlerDevEnv(await startHardhatNodeAndDeployBehodlerContracts())
        fastify.log.info('dev env started')
      } catch (error) {
        fastify.log.error(`starting dev env failed: ${error}`)
      }
    }

    setStartDevEnv(startDevEnv)
    done()
  }
}

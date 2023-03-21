import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import fs from 'fs'
import path from 'path'
import { FastifyPluginCallback } from 'fastify'

import {
  BehodlerDevEnv,
  BehodlerDevEnvFastifyInstance,
  BehodlerDevEnvDeploymentConfig,
  BehodlerDevEnvRuntimeConfig,
  BehodlerDevEnvNodeSettings,
} from './types'
import { safeDeploy } from '../../../scripts/networks/orchestrate'

const DEPLOYMENT_CONFIG: BehodlerDevEnvDeploymentConfig = {
  miningIntervalMs: 2000,
  autoMining: true,
  recipeName: 'testnet',
  confirmationsNumber: 1,
  addressesJSONFilePath: path.resolve(
    __dirname,
    '../../../scripts/networks/addresses/hardhat.json',
  ),
}

const RUNTIME_CONFIG: BehodlerDevEnvRuntimeConfig = {
  miningIntervalMs: 12000,
  autoMining: false,
}

const HRE_NODE_SETTINGS: BehodlerDevEnvNodeSettings = {
  noDeploy: true,
  silent: true,
  port: 8550,
}

export function startDevEnvPlugin({ setBehodlerDevEnv, setStartDevEnv }): FastifyPluginCallback {
  const initialBehodlerDevEnv: BehodlerDevEnv = {
    active: false,
    snapshots: [],
  }

  const setAutoMining = async (autoMining: boolean, logger): Promise<void> => {
    logger.info(`${DEPLOYMENT_CONFIG.autoMining ? 'enabling' : 'disabling'} auto mining`)
    await hre.network.provider.send('evm_setAutomine', [DEPLOYMENT_CONFIG.autoMining])
    logger.info(`auto mining ${DEPLOYMENT_CONFIG.autoMining ? 'enabled' : 'disabled'}`)
  }

  const setMiningInterval = async (miningIntervalMs: number, logger): Promise<void> => {
    logger.info(`setting mining interval to ${miningIntervalMs / 1000} seconds`)
    await hre.network.provider.send('evm_setIntervalMining', [miningIntervalMs])
    logger.info(`mining interval set to ${miningIntervalMs / 1000} seconds`)
  }

  return function (fastify: BehodlerDevEnvFastifyInstance, opts, done): void {
    async function startHardhatNodeAndDeployBehodlerContracts(): Promise<BehodlerDevEnv> {
      fastify.log.info('starting hardhat node')
      const node: Promise<any> = hre.run('node', HRE_NODE_SETTINGS)
      const { chainId } = await hre.ethers.provider.getNetwork()

      await setAutoMining(DEPLOYMENT_CONFIG.autoMining, fastify.log)
      await setMiningInterval(DEPLOYMENT_CONFIG.miningIntervalMs, fastify.log)

      fastify.log.info('deploying Behodler contracts')
      const deployedAddresses = await safeDeploy(
        DEPLOYMENT_CONFIG.recipeName,
        chainId,
        DEPLOYMENT_CONFIG.confirmationsNumber,
        message => fastify.log.info(`deployment: ${message}`),
      )
      fastify.log.info('deployment complete')

      if (RUNTIME_CONFIG.autoMining !== DEPLOYMENT_CONFIG.autoMining) {
        await setAutoMining(RUNTIME_CONFIG.autoMining, fastify.log)
      }

      if (RUNTIME_CONFIG.miningIntervalMs !== DEPLOYMENT_CONFIG.miningIntervalMs) {
        await setMiningInterval(RUNTIME_CONFIG.miningIntervalMs, fastify.log)
      }

      return { ...initialBehodlerDevEnv, active: true, node, deployedAddresses }
    }

    async function startDevEnv() {
      try {
        fastify.log.info('starting dev env')

        if (fastify?.behodlerDevEnv?.active) {
          return fastify.log.info('dev env already running')
        }

        if (fs.existsSync(DEPLOYMENT_CONFIG.addressesJSONFilePath)) {
          fastify.log.info(`removing ${DEPLOYMENT_CONFIG.addressesJSONFilePath}`)
          fs.rmSync(DEPLOYMENT_CONFIG.addressesJSONFilePath)
          fastify.log.info('file removed, starting dev env')
        }
        const behodlerDevEnv:BehodlerDevEnv = await startHardhatNodeAndDeployBehodlerContracts()
        setBehodlerDevEnv(behodlerDevEnv)
        fastify.log.info('dev env started')
        const { chainId } = await hre.ethers.provider.getNetwork()
        fastify.log.info('chainId ' + chainId)
        const [deployer] = await hre.ethers.getSigners();
        fastify.log.info('Deployer account ' + deployer.address)
      } catch (error) {
        fastify.log.error(`starting dev env failed: ${error}`)
      }
    }

    setStartDevEnv(startDevEnv)
    done()
  }
}

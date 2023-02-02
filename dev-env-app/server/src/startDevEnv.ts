import hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { FastifyPluginCallback } from 'fastify'

import { BehodlerDevEnv, BehodlerDevEnvFastifyInstance } from './types'
import { safeDeploy } from '../../../scripts/networks/orchestrate'

const initialBehodlerDevEnv: BehodlerDevEnv = {
  active: false,
  snapshots: [],
}

export function startDevEnvPlugin({
  setBehodlerDevEnv,
  setStartDevEnv,
}): FastifyPluginCallback {
  return function (fastify: BehodlerDevEnvFastifyInstance, opts, done): void {
    async function startHardhatNodeAndDeployBehodlerContracts(): Promise<BehodlerDevEnv> {
      const node: Promise<any> = hre.run('node', { noDeploy: true })
      fastify.log.info('started hardhat node')
      const { chainId } = await hre.ethers.provider.getNetwork()
      fastify.log.info('deploying Behodler contracts')
      const deployedAddresses = await safeDeploy(chainId, 2, 9)
      fastify.log.info('deployment complete')
      return { ...initialBehodlerDevEnv, active: true, node, deployedAddresses }
    }

    async function startDevEnv() {
      try {
        fastify.log.info('starting dev env')

        if (fastify?.behodlerDevEnv?.active) {
          return fastify.log.info('dev env already running')
        }

        const hardhatDeployedAddressesFilePath = path.resolve(
          __dirname,
          '../../../scripts/networks/addresses/hardhat.json',
        )

        if (fs.existsSync(hardhatDeployedAddressesFilePath)) {
          fastify.log.info(`removing ${hardhatDeployedAddressesFilePath}`)
          fs.rmSync(hardhatDeployedAddressesFilePath)
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

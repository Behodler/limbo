import hre, { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers'
import fs from 'fs'
import path from 'path'

import { DevEnvNode } from './types'
import { safeDeploy } from '../../../scripts/networks/orchestrate'

export function api(fastify, _, done) {
  let devEnvNode: DevEnvNode = { active: false }
  let devEnvSnapshots: SnapshotRestorer[] = []

  const paths = {
    hardhatDeployedAddresses: path.resolve(
      __dirname,
      '../../../scripts/networks/addresses/hardhat.json',
    ),
  }

  fastify.post('/start', startDevEnv)
  fastify.post('/create-snapshot', createSnapshot)
  fastify.post('/restore-snapshot', restoreSnapshot)
  fastify.get('/get-snapshots', getSnapshotIds)

  fastify.get('/test-get-balances', async () => {
    const [sender, receiver] = await ethers.getSigners()
    const senderETHBalance = ethers.utils.formatEther(await sender.getBalance())
    const receiverETHBalance = ethers.utils.formatEther(await receiver.getBalance())
    fastify.log.info(
      `ETH balances: sender has ${senderETHBalance}, receiver has ${receiverETHBalance}`,
    )
    return { senderETHBalance, receiverETHBalance }
  })

  fastify.post('/test-send-eth', async () => {
    const [sender, receiver] = await ethers.getSigners()
    fastify.log.info('Sending 1 ETH from sender to receiver')
    const tx = await sender.sendTransaction({
      to: receiver.address,
      value: ethers.utils.parseEther('1'),
    })
    fastify.log.info(`Tx sent: ${tx.hash}`)
    return { txHash: tx.hash }
  })

  done()

  function createResponse(message, data = {}) {
    return {
      message,
      ...data,
    }
  }

  function createInfoResponse(message, data = {}) {
    fastify.log.info(message)
    return createResponse(message, data)
  }

  function createErrorResponse(message, data = {}) {
    fastify.log.error(message)
    return createResponse(message, data)
  }

  async function startHardhatNodeAndDeployBehodlerContracts(): Promise<DevEnvNode> {
    const node = hre.run('node', { noDeploy: true })
    fastify.log.info('started hardhat node')
    const { chainId } = await hre.ethers.provider.getNetwork()
    fastify.log.info('deploying Behodler contracts')
    const deployedAddresses = await safeDeploy(chainId, 2, 9)
    fastify.log.info('deployment complete')
    return { active: true, node, deployedAddresses }
  }

  async function startDevEnv() {
    try {
      fastify.log.info('starting dev env')

      if (devEnvNode.active) {
        return createInfoResponse('dev env already running', {
          deployedAddresses: devEnvNode.deployedAddresses,
        })
      }

      if (fs.existsSync(paths.hardhatDeployedAddresses)) {
        fastify.log.info(`removing ${paths.hardhatDeployedAddresses}`)
        fs.rmSync(paths.hardhatDeployedAddresses)
        fastify.log.info('file removed, starting dev env')
      }

      devEnvNode = await startHardhatNodeAndDeployBehodlerContracts()
      return createInfoResponse('dev env started', {
        deployedAddresses: devEnvNode.deployedAddresses,
      })
    } catch (error) {
      return createErrorResponse('starting dev env failed', { error })
    }
  }

  async function createSnapshot() {
    if (devEnvNode.active) {
      fastify.log.info('creating snapshot')

      try {
        const snapshot = await takeSnapshot()
        devEnvSnapshots.push(snapshot)
        return createInfoResponse('snapshot saved', { snapshotId: snapshot.snapshotId })
      } catch (error) {
        return createErrorResponse('creating snapshot failed', { error })
      }
    } else {
      return createInfoResponse('dev env not started')
    }
  }

  async function restoreSnapshot(request) {
    /* TODO
     * If we create multiple snapshots and restore the one that was created first
     * (for the lowest block number), the old snapshots are invalidated and trying
     * to restore them fails.
     *
     * I need to implement removing invalid snapshots from the array. Should be easy, I'm
     * leaving this comment here so I don't forget.
     * */
    if (devEnvNode.active) {
      fastify.log.info('restoring snapshot')

      try {
        const snapshot = devEnvSnapshots.find(
          ({ snapshotId }) => snapshotId === request.body?.snapshotId,
        )

        if (snapshot?.snapshotId) {
          fastify.log.info(`restoring snapshot ${snapshot.snapshotId}`)
          await snapshot.restore()
          return createInfoResponse('snapshot restored', { snapshotId: snapshot.snapshotId })
        } else {
          return createInfoResponse('invalid snapshot id', {
            snapshotId: snapshot?.snapshotId,
            savedSnapshotIds: devEnvSnapshots.map(({ snapshotId }) => snapshotId),
          })
        }
      } catch (error) {
        return createErrorResponse(`restoring Snapshot failed: ${error}`, { error })
      }
    } else {
      return createInfoResponse('dev env not started')
    }
  }

  function getSnapshotIds() {
    if (devEnvNode.active) {
      const snapshotIds = devEnvSnapshots.map(({ snapshotId }) => snapshotId)
      return createInfoResponse('saved snapshot ids fetched', { snapshotIds })
    } else {
      return createInfoResponse('dev env not started')
    }
  }
}

import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers'

import { BehodlerDevEnvFastifyInstance } from './types'

export function api(fastify: BehodlerDevEnvFastifyInstance, _, done) {
  let devEnvSnapshots: SnapshotRestorer[] = []

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

  async function createSnapshot() {
    if (fastify.behodlerDevEnv?.active) {
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
    if (fastify.behodlerDevEnv?.active) {
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
    if (fastify.behodlerDevEnv?.active) {
      const snapshotIds = devEnvSnapshots.map(({ snapshotId }) => snapshotId)
      return createInfoResponse('saved snapshot ids fetched', { snapshotIds })
    } else {
      return createInfoResponse('dev env not started')
    }
  }
}

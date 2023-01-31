import hre, { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers'
import Fastify, { FastifyInstance } from 'fastify'
import path from 'path'
import { ChildProcess, fork } from 'child_process'
import fs from 'fs'
import { HardhatContext } from 'hardhat/internal/context'
import { safeDeploy } from '../../../scripts/networks/orchestrate'

const fastify: FastifyInstance = Fastify({
  logger: {
    transport: {
      target: '@fastify/one-line-logger',
    },
  },
})

let devEnvChildProcess:
  | ChildProcess
  | undefined
  | {
      killed: boolean
      node: Promise<void>
      deployedAddresses: any
    }
let devEnvSnapshots: SnapshotRestorer[] = []

const paths = {
  hardhatDeployedAddresses: path.resolve(
    __dirname,
    '../../../scripts/networks/addresses/hardhat.json',
  ),
}

async function runNodeAndDeploy() {
  if (!HardhatContext.isCreated()) {
    HardhatContext.createHardhatContext()
    fastify.log.info('created hardhat context')
  }

  const node = hre.run('node', { noDeploy: true })
  fastify.log.info('started hardhat node')
  const { chainId } = await hre.ethers.provider.getNetwork()
  fastify.log.info('deploying Behodler contracts')
  const deployedAddresses = await safeDeploy(chainId, 2, 9)
  fastify.log.info('deployment complete')
  return { killed: false, node, deployedAddresses }
}

async function startDevEnv() {
  try {
    fastify.log.info('starting dev env')

    if (devEnvChildProcess && !devEnvChildProcess.killed) {
      fastify.log.info('dev env already started')
      return false
    }

    if (fs.existsSync(paths.hardhatDeployedAddresses)) {
      fastify.log.info(`removing ${paths.hardhatDeployedAddresses}`)
      fs.rmSync(paths.hardhatDeployedAddresses)
      fastify.log.info('file removed, starting dev env')
    }

    devEnvChildProcess = await runNodeAndDeploy()
    fastify.log.info('dev env started')
    return devEnvChildProcess.deployedAddresses
  } catch (error) {
    fastify.log.error(`starting dev env failed: ${error}`)
    return false
  }
}

function stopDevEnv() {
  if (devEnvChildProcess) {
    fastify.log.info('stopping dev env')
    devEnvChildProcess = undefined
    return true
  }

  fastify.log.info('dev env already stopped')
  return false
}

async function createSnapshot() {
  if (devEnvChildProcess) {
    fastify.log.info('creating snapshot')

    try {
      const snapshot = await takeSnapshot()
      devEnvSnapshots.push(snapshot)
      fastify.log.info(`snapshot ${snapshot.snapshotId} saved`)
      return true
    } catch (error) {
      fastify.log.error(`creating snapshot failed: ${error}`)
      return false
    }
  } else {
    fastify.log.info('dev env not started')
    return false
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
  if (devEnvChildProcess) {
    fastify.log.info('restoring snapshot')

    try {
      const snapshot = devEnvSnapshots.find(
        ({ snapshotId }) => snapshotId === request.body?.snapshotId,
      )

      if (snapshot?.snapshotId) {
        fastify.log.info(`restoring snapshot ${snapshot.snapshotId}`)
        await snapshot.restore()
        fastify.log.info(`snapshot ${snapshot.snapshotId} restored`)
        return true
      } else {
        fastify.log.info('invalid snapshot id')
        return false
      }
    } catch (error) {
      fastify.log.error(`restoring Snapshot failed: ${error}`)
      return false
    }
  } else {
    fastify.log.info('dev env not started')
    return false
  }
}

function getSnapshotIds() {
  if (devEnvChildProcess) {
    const snapshotIds = devEnvSnapshots.map(({ snapshotId }) => snapshotId)
    fastify.log.info(`saved snapshot ids: ${snapshotIds.join(', ')}`)
    return snapshotIds
  } else {
    fastify.log.info('dev env not started')
    return false
  }
}

fastify.post('/start', startDevEnv)
fastify.post('/stop', stopDevEnv)
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

fastify.ready().then(() => {
  fastify.listen({ port: 6667 })
})

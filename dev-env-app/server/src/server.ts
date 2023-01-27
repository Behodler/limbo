import Fastify, { FastifyInstance } from 'fastify'
import path from 'path'
import { ChildProcess, fork } from 'child_process'
import { HardhatContext } from 'hardhat/internal/context'
import { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers'

import { ProcessMessage } from './types'

HardhatContext.createHardhatContext()

const fastify: FastifyInstance = Fastify({
  logger: {
    transport: {
      target: '@fastify/one-line-logger',
    },
  },
})

let devEnvChildProcess: ChildProcess | undefined
let devEnvSnapshots: SnapshotRestorer[] = []

fastify.post('/start', async () => {
  if (!devEnvChildProcess || devEnvChildProcess?.killed) {
    fastify.log.info('starting dev env')
    devEnvChildProcess = fork(path.resolve(__dirname, './hre.ts'))
    devEnvChildProcess.send({ type: 'start' })

    devEnvChildProcess.on('message', (msg: ProcessMessage) => {
      if (msg.type === 'snapshots') {
        fastify.log.info('updating devEnvSnapshots')
        devEnvSnapshots = [...msg.data]
      }

      if (msg.type === 'snapshotRestored') {
        fastify.log.info(msg.data)
      }

      if (msg.type === 'snapshotRestoringFailed') {
        fastify.log.info(msg.data)
      }
    })
  } else {
    fastify.log.info('dev env already started')
  }
})

fastify.post('/stop', async () => {
  if (devEnvChildProcess) {
    devEnvChildProcess.kill()
    fastify.log.info('stopping dev env')
  }

  fastify.log.info('dev env already stopped')
})

fastify.post('/create-snapshot', async () => {
  if (devEnvChildProcess) {
    fastify.log.info('creating snapshot')
    devEnvChildProcess.send({ type: 'createSnapshot' })
  } else {
    fastify.log.info('dev env not started')
  }
})

fastify.post('/restore-snapshot', async () => {
  const snapshotId = devEnvSnapshots[0]?.snapshotId

  if (devEnvChildProcess && snapshotId) {
    fastify.log.info(`restoring snapshot ${snapshotId}`)
    devEnvChildProcess.send({ type: 'restoreSnapshot', data: snapshotId })
  } else {
    fastify.log.info('dev env not started or invalid snapshot id')
  }

})

fastify.get('/get-snapshots', async () => {
  if (devEnvChildProcess) {
    fastify.log.info('fetching saved snapshot ids')
    devEnvChildProcess.send({ type: 'getSnapshots' })
    await(new Promise(resolve => setTimeout(resolve, 100)))
    const snapshotIds = devEnvSnapshots.map(({ snapshotId }) => snapshotId)
    fastify.log.info(`saved snapshot ids: ${snapshotIds.join(', ')}`)
    return snapshotIds
  } else {
    fastify.log.info('dev env not started')
  }
})

fastify.post('/test', async () => {
  if (devEnvChildProcess) {
    fastify.log.info('sending some txs against the dev env')
    devEnvChildProcess.send({ type: 'test' })
  } else {
    fastify.log.info('dev env not started')
  }
})

fastify.ready().then(() => {
  fastify.listen({ port: 6667 })
})


import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers'
import { BehodlerDevEnvFastifyInstance } from '../types'

export default function (fastify: BehodlerDevEnvFastifyInstance, _, done): void {
  fastify.post('/create-snapshot', createSnapshot)
  done()

  async function createSnapshot() {
    if (fastify.behodlerDevEnv?.active) {
      fastify.log.info('creating snapshot')

      try {
        const snapshot: SnapshotRestorer = await takeSnapshot()
        fastify.behodlerDevEnv.snapshots.push(snapshot)
        return fastify?.createInfoResponse?.(`snapshot ${snapshot.snapshotId} saved`, {
          snapshotId: snapshot.snapshotId,
        })
      } catch (error) {
        return fastify?.createErrorResponse?.(`creating snapshot failed: ${error}`, { error })
      }
    } else {
      return fastify?.createInfoResponse?.('dev env not started')
    }
  }
}

import { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers'
import { BehodlerDevEnvFastifyInstance } from '../types'

export default function (fastify: BehodlerDevEnvFastifyInstance, _, done): void {
  fastify.post('/restore-snapshot', restoreSnapshot)
  done()

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
        const snapshot: SnapshotRestorer | undefined = fastify.behodlerDevEnv.snapshots.find(
          ({ snapshotId }) => snapshotId === request.body?.snapshotId,
        )

        if (snapshot?.snapshotId) {
          fastify.log.info(`restoring snapshot ${snapshot.snapshotId}`)
          await snapshot.restore()
          return fastify?.createInfoResponse?.(`snapshot ${snapshot.snapshotId} restored`, {
            snapshotId: snapshot.snapshotId,
          })
        } else {
          return fastify?.createInfoResponse?.(`invalid snapshot id: ${snapshot?.snapshotId}`, {
            snapshotId: snapshot?.snapshotId,
            savedSnapshotIds: fastify.behodlerDevEnv.snapshots.map(({ snapshotId }) => snapshotId),
          })
        }
      } catch (error) {
        return fastify?.createErrorResponse?.(`restoring Snapshot failed: ${error}`, { error })
      }
    } else {
      return fastify?.createInfoResponse?.('dev env not started')
    }
  }
}

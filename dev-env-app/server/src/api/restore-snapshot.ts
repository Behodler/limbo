import { BehodlerDevEnvFastifyInstance } from '../types'

export default function (fastify: BehodlerDevEnvFastifyInstance, _, done): void {
  fastify.post('/restore-snapshot', restoreSnapshot)
  done()

  async function restoreSnapshot(request) {
    if (fastify.behodlerDevEnv?.active) {
      fastify.log.info('restoring snapshot')

      try {
        const snapshot = fastify.behodlerDevEnv.snapshots.find(
          ({ snapshotId }) => snapshotId === request.body?.snapshotId,
        )


        if (snapshot?.snapshotId) {
          const snapshotIndex = fastify.behodlerDevEnv.snapshots.indexOf(snapshot)
          fastify.log.info(`restoring snapshot ${snapshot.snapshotId}`)
          await snapshot.restore()
          const invalidatedSnapshots = fastify.behodlerDevEnv.snapshots.splice(snapshotIndex + 1)
          return fastify?.createInfoResponse?.(`snapshot ${snapshot.snapshotId} restored`, {
            snapshotId: snapshot.snapshotId,
            invalidatedSnapshotIds: invalidatedSnapshots.map(({ snapshotId }) => snapshotId),
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

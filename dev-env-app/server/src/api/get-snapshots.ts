import { BehodlerDevEnvFastifyInstance } from '../types'

export default function (fastify: BehodlerDevEnvFastifyInstance, _, done): void {
  fastify.get('/get-snapshots', getSnapshotIds)
  done()

  function getSnapshotIds() {
    if (fastify.behodlerDevEnv?.active) {
      const snapshotIds = fastify.behodlerDevEnv.snapshots.map(({ snapshotId }) => snapshotId)
      return fastify?.createInfoResponse?.(`saved snapshot ids fetched: ${snapshotIds.join(', ')}`, { snapshotIds })
    } else {
      return fastify?.createInfoResponse?.('dev env not started')
    }
  }
}

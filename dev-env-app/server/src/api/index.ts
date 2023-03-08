import { BehodlerDevEnvFastifyInstance } from '../types'
import createSnapshot from './create-snapshot'
import restoreSnapshot from './restore-snapshot'
import getSnapshots from './get-snapshots'
import getDeploymentAddresses from './get-deployment-addresses'

export function api(fastify: BehodlerDevEnvFastifyInstance, _, done) {
  fastify.register(createSnapshot)
  fastify.register(restoreSnapshot)
  fastify.register(getSnapshots)
  fastify.register(getDeploymentAddresses)

  done()
}

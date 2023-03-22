import { BehodlerDevEnvFastifyInstance } from '../types'

export default function (fastify: BehodlerDevEnvFastifyInstance, _, done): void {
  fastify.get('/get-token-configs', getTokenConfigs)
  done()

  function getTokenConfigs() {
    if (fastify.behodlerDevEnv?.active) {
      return (fastify.behodlerDevEnv?.set && fastify.behodlerDevEnv?.set.tokens?.length > 0)
        ? fastify?.createInfoResponse?.('tokens found', {
          contracts: fastify.behodlerDevEnv?.set.tokens,
        })
        : fastify?.createInfoResponse?.('no tokens found')
    } else {
      return fastify?.createInfoResponse?.('dev env not started')
    }
  }
}

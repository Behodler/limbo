import Fastify from 'fastify'

import { api } from './api'
import { BehodlerDevEnvFastifyInstance, BehodlerDevEnv, StartDevEnv } from './types'
import { startDevEnvPlugin } from './startDevEnv'

function initApp(): BehodlerDevEnvFastifyInstance {
  const fastify: BehodlerDevEnvFastifyInstance = Fastify({
    logger: {
      transport: {
        target: '@fastify/one-line-logger',
      },
    },
  })

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

  fastify.decorate('behodlerDevEnv', undefined)
  fastify.decorate('startDevEnv', undefined)
  fastify.decorate('createInfoResponse', createInfoResponse)
  fastify.decorate('createErrorResponse', createErrorResponse)

  fastify.register(api)
  fastify.register(
    startDevEnvPlugin({
      setBehodlerDevEnv: (behodlerDevEnv: BehodlerDevEnv) => {
        fastify.behodlerDevEnv = behodlerDevEnv
      },
      setStartDevEnv: (startDevEnv: StartDevEnv) => {
        fastify.startDevEnv = startDevEnv
      },
    }),
  )

  return fastify
}

;(async () => {
  const fastify = initApp()
  await fastify.ready()
  await fastify.listen({ port: 6667 })
  await fastify?.startDevEnv?.()
})()

import Fastify from 'fastify'

import { api } from './api'
import { BehodlerDevEnvFastifyInstance } from './types'
import { startDevEnvPlugin } from './startDevEnv'

function initApp(): BehodlerDevEnvFastifyInstance {
  const fastify: BehodlerDevEnvFastifyInstance = Fastify({
    logger: {
      transport: {
        target: '@fastify/one-line-logger',
      },
    },
  })

  function setBehodlerDevEnv(behodlerDevEnv) {
    fastify.behodlerDevEnv = behodlerDevEnv
  }

  function setStartDevEnv(startDevEnv) {
    fastify.startDevEnv = startDevEnv
  }

  fastify.decorate('behodlerDevEnv', undefined)
  fastify.decorate('startDevEnv', undefined)
  fastify.register(api)
  fastify.register(startDevEnvPlugin({ setBehodlerDevEnv, setStartDevEnv }))

  return fastify
}

;(async () => {
  const fastify = initApp()
  await fastify.ready()
  await fastify.listen({ port: 6667 })
  await fastify?.startDevEnv?.()
})()

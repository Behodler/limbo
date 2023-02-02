import Fastify, { FastifyInstance } from 'fastify'

import { api } from './api'

function initApp() {
  const fastify: FastifyInstance = Fastify({
    logger: {
      transport: {
        target: '@fastify/one-line-logger',
      },
    },
  })

  fastify.register(api)
  return fastify
}

(async () => {
  const app = initApp()
  await app.ready()
  await app.listen({ port: 6667 })
  console.info('app', app.server.address());
  // await fetch(app.server.address())
})()

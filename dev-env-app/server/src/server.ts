import Fastify from 'fastify'
import parseArgv from 'minimist'

import { api } from './api'
import { BehodlerDevEnvFastifyInstance, BehodlerDevEnv, StartDevEnv } from './types'
import { startDevEnvPlugin } from './startDevEnv'
import cors from '@fastify/cors'

const parsedArgv = parseArgv(process.argv)
const serverPort = parsedArgv.p || parsedArgv.port || 1024
async function initApp(): Promise<BehodlerDevEnvFastifyInstance> {
  const fastify: BehodlerDevEnvFastifyInstance = Fastify({
    logger: {
      transport: {
        target: '@fastify/one-line-logger',
      },
    }
  })
await fastify.register(cors,{
  origin:true,
  methods:"GET",
  allowedHeaders:"*"
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
  const fastify =await initApp()
  await fastify.ready()
  await fastify.listen({ port: serverPort })
  await fastify?.startDevEnv?.()
})()

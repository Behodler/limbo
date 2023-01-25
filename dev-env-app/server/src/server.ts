import Fastify, { FastifyInstance } from 'fastify'

export const fastify: FastifyInstance = Fastify({
  logger: true,
})

fastify.get('/', (req, res) => {
  return 'hello worlds'
})

fastify.listen({ port: 6667 })
